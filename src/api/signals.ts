import { supabase } from '../lib/supabase';
import { todayString } from '../lib/format';

export type TabSignals = {
  /** Bills past their due date with at least one share still unpaid. */
  overdueBills: number;
  /** When the most recent note by somebody else landed, or null for none. */
  latestNoteAt: string | null;
};

/**
 * The two counts the tab bar draws on, fetched on their own rather than taken
 * from the screens' data.
 *
 * The tab bar outlives every screen, and a badge that only appears once you've
 * opened the tab it belongs to is pointless — that is the tap it exists to
 * save. These read a handful of columns each, which is cheap enough to run
 * beside the full fetches the screens do.
 */
export async function fetchTabSignals(
  householdId: string,
  userId: string | null
): Promise<TabSignals> {
  const today = todayString();

  const [bills, notes] = await Promise.all([
    supabase
      .from('bills')
      .select('id, splits:bill_splits(paid)')
      .eq('household_id', householdId)
      .not('due_date', 'is', null)
      .lt('due_date', today),
    // A note you wrote yourself is not news to you, so the board's dot ignores
    // your own. `neq` on a null user id would filter out everything, hence the
    // guard.
    userId
      ? supabase
          .from('announcements')
          .select('created_at')
          .eq('household_id', householdId)
          .neq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (bills.error) throw bills.error;
  if (notes.error) throw notes.error;

  // Cast through `unknown` like the rest of the bill queries: the generated
  // types don't carry the bills → bill_splits relationship, so the embed comes
  // back typed as a relation error.
  const overdue = (bills.data ?? []) as unknown as { splits: { paid: boolean }[] }[];

  const overdueBills = overdue.filter((bill) => {
    const splits = bill.splits ?? [];
    // Matches `isBillSettled`: a bill with no splits at all isn't settled.
    return splits.length === 0 || splits.some((split) => !split.paid);
  }).length;

  return {
    overdueBills,
    latestNoteAt: (notes.data as { created_at: string } | null)?.created_at ?? null,
  };
}
