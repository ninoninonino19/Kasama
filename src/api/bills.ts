import { supabase } from '../lib/supabase';
import { addDays, fromDateString, toDateString, todayString } from '../lib/format';
import type { BillCategory, BillRecurrence } from '../lib/database.types';
import type { BalanceSummary, BillWithSplits, LedgerEntry } from '../types';

export async function fetchBills(householdId: string): Promise<BillWithSplits[]> {
  const { data, error } = await supabase
    .from('bills')
    .select('*, splits:bill_splits(*, profile:profiles(*))')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as BillWithSplits[];
}

export async function fetchBill(billId: string): Promise<BillWithSplits | null> {
  const { data, error } = await supabase
    .from('bills')
    .select('*, splits:bill_splits(*, profile:profiles(*))')
    .eq('id', billId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as unknown as BillWithSplits | null;
}

export type NewBillInput = {
  householdId: string;
  createdBy: string;
  title: string;
  amount: number;
  category: BillCategory;
  dueDate: string | null;
  recurrence: BillRecurrence;
  /** user_id → amount owed. Everyone starts unpaid, whoever logged it included. */
  splits: { userId: string; amount: number }[];
};

export async function createBill(input: NewBillInput): Promise<BillWithSplits> {
  const { data: bill, error } = await supabase
    .from('bills')
    .insert({
      household_id: input.householdId,
      created_by: input.createdBy,
      title: input.title.trim(),
      amount: input.amount,
      category: input.category,
      due_date: input.dueDate,
      recurrence: input.recurrence,
    })
    .select('*')
    .single();

  if (error) throw error;

  const rows = input.splits
    // A share of nothing is not a share. Someone left out of a bill has no row
    // on it, rather than a ₱0.00 one that keeps it looking unsettled.
    .filter((split) => split.amount > 0)
    .map((split) => ({
      bill_id: bill.id,
      user_id: split.userId,
      amount_owed: split.amount,
    }));

  if (rows.length > 0) {
    const { error: splitError } = await supabase.from('bill_splits').insert(rows);
    if (splitError) {
      // Don't leave a bill with no splits behind if the second write fails.
      await supabase.from('bills').delete().eq('id', bill.id);
      throw splitError;
    }
  }

  const created = await fetchBill(bill.id);
  if (!created) throw new Error('Bill was created but could not be loaded.');
  return created;
}

/**
 * Whether a bill's money is settled enough that editing it would rewrite
 * someone's record of having paid.
 *
 * Every paid share counts, the collector's included. It used to skip theirs,
 * because `createBill` set it for them and a flag nobody chose is not a
 * payment — but nothing sets it for them any more, so a tick on their row
 * means what it means on everyone else's.
 */
export function billSplitsLocked(bill: BillWithSplits): boolean {
  return bill.splits.some((split) => split.paid);
}

export type BillUpdateInput = {
  title: string;
  category: BillCategory;
  dueDate: string | null;
  recurrence: BillRecurrence;
  /** Both omitted once `billSplitsLocked` is true. */
  amount?: number;
  splits?: { userId: string; amount: number }[];
};

export async function updateBill(
  bill: BillWithSplits,
  input: BillUpdateInput
): Promise<void> {
  const { error } = await supabase
    .from('bills')
    .update({
      title: input.title.trim(),
      category: input.category,
      due_date: input.dueDate,
      recurrence: input.recurrence,
      ...(input.amount === undefined ? null : { amount: input.amount }),
    })
    .eq('id', bill.id);

  if (error) throw error;
  if (!input.splits) return;

  // Reconcile rather than replace. `bill_splits` is unique on (bill_id,
  // user_id), so a delete-all-then-insert would have to leave the bill with no
  // splits in between — and a failure at that moment would strand it with a
  // total nobody owes. Updating in place also keeps each row's paid flag.
  const wanted = new Map(input.splits.map((split) => [split.userId, split.amount]));

  const removed = bill.splits.filter((split) => !wanted.has(split.user_id));
  const kept = bill.splits.filter((split) => wanted.has(split.user_id));
  const added = input.splits.filter(
    (split) => !bill.splits.some((existing) => existing.user_id === split.userId)
  );

  for (const split of kept) {
    const amount = wanted.get(split.user_id) ?? 0;
    if (Number(split.amount_owed) === amount) continue;
    const { error: updateError } = await supabase
      .from('bill_splits')
      .update({ amount_owed: amount })
      .eq('id', split.id);
    if (updateError) throw updateError;
  }

  if (added.length > 0) {
    const { error: insertError } = await supabase.from('bill_splits').insert(
      added.map((split) => ({
        bill_id: bill.id,
        user_id: split.userId,
        amount_owed: split.amount,
        // Same rule as when the bill was created: a new share starts owed.
        // Adding someone to a bill cannot mark them as having paid it.
      }))
    );
    if (insertError) throw insertError;
  }

  if (removed.length > 0) {
    const { error: deleteError } = await supabase
      .from('bill_splits')
      .delete()
      .in('id', removed.map((split) => split.id));
    if (deleteError) throw deleteError;
  }
}

export async function setSplitPaid(splitId: string, paid: boolean): Promise<void> {
  const { error } = await supabase
    .from('bill_splits')
    .update({ paid, paid_at: paid ? new Date().toISOString() : null })
    .eq('id', splitId);

  if (error) throw error;
}

export async function settleWholeBill(billId: string): Promise<void> {
  const { error } = await supabase
    .from('bill_splits')
    .update({ paid: true, paid_at: new Date().toISOString() })
    .eq('bill_id', billId)
    .eq('paid', false);

  if (error) throw error;
}

/**
 * Creates the next occurrence of a recurring bill, if this one has just become
 * fully settled.
 *
 * Safe to call after any payment: the database function decides whether there
 * is anything to do, and doing it twice is a no-op. It has to run there rather
 * than here because the bills insert policy requires `created_by = auth.uid()`
 * — done from the client, whoever ticked the last split would become the
 * collector of next month's rent. It also drops housemates who have moved out
 * in the meantime, which the client cannot see from a single bill.
 */
export async function rollRecurringBill(billId: string): Promise<void> {
  const { error } = await supabase.rpc('roll_recurring_bill', {
    source_bill_id: billId,
  });
  if (error) throw error;
}

export async function deleteBill(billId: string): Promise<void> {
  const { error } = await supabase.from('bills').delete().eq('id', billId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Derived values (kept here so the dashboard and bills tab agree)
// ---------------------------------------------------------------------------

export function isBillSettled(bill: BillWithSplits): boolean {
  return bill.splits.length > 0 && bill.splits.every((split) => split.paid);
}

export function billOutstanding(bill: BillWithSplits): number {
  return bill.splits
    .filter((split) => !split.paid)
    .reduce((total, split) => total + Number(split.amount_owed), 0);
}

/** How many of the splits are settled — drives the "2 of 3 paid" indicator. */
export function billProgress(bill: BillWithSplits): { paid: number; total: number; ratio: number } {
  const total = bill.splits.length;
  const paid = bill.splits.filter((split) => split.paid).length;
  return { paid, total, ratio: total === 0 ? 0 : paid / total };
}

export type BillStatus = 'settled' | 'overdue' | 'due-soon' | 'open';

/** Days from today at which an unpaid bill starts reading as urgent. */
const DUE_SOON_DAYS = 3;

/**
 * One place that decides how a bill reads, so the dashboard, the list and the
 * detail screen can never disagree about whether something is overdue.
 */
export function billStatus(bill: BillWithSplits, today = todayString()): BillStatus {
  if (isBillSettled(bill)) return 'settled';
  if (!bill.due_date) return 'open';

  const due = bill.due_date.slice(0, 10);
  if (due < today) return 'overdue';

  return due <= toDateString(addDays(fromDateString(today), DUE_SOON_DAYS)) ? 'due-soon' : 'open';
}

/**
 * The smallest amount of money this app can talk about.
 *
 * Every total below is rounded to it before anyone sees it. Splitting ₱1,000
 * three ways and adding the thirds back leaves 2.2e-13 behind, and a residue
 * that small still fails `!== 0` — which is how "You owe ₱0.00" ends up drawn
 * in red next to a bill everybody has paid. Rounding at the boundary means the
 * screens can compare against a centavo and trust the answer.
 */
const CENTAVO = 0.01;

function toCentavos(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Whether a total is money, or floating-point dust left over from a split. */
export function isSettledAmount(amount: number): boolean {
  return Math.abs(amount) < CENTAVO;
}

/**
 * Where the signed-in user stands across every unsettled bill.
 *
 *  - `owed` is everything they still have to hand over: their own unpaid
 *    shares, on their own bills as much as anyone else's. Logging a bill is
 *    not paying it, so a share they have not ticked is a share they owe —
 *    which is the number the Bills header leads with, and the one that has to
 *    read ₱0.00 the moment the last tick lands.
 *  - `owing` is what the house still owes them: unpaid shares belonging to
 *    other people, on bills they are collecting for.
 *
 * Their own share never appears on both sides — the second branch skips it —
 * so a bill they logged and have not paid counts once, as something owed.
 */
export function summariseBalance(bills: BillWithSplits[], userId: string): BalanceSummary {
  let owed = 0;
  let owing = 0;

  for (const bill of bills) {
    for (const split of bill.splits) {
      if (split.paid) continue;
      const amount = Number(split.amount_owed);

      if (split.user_id === userId) {
        // Mine to pay, whoever logged the bill.
        owed += amount;
      } else if (bill.created_by === userId) {
        // I'm collecting for this one and this housemate hasn't settled.
        owing += amount;
      }
    }
  }

  owed = toCentavos(owed);
  owing = toCentavos(owing);

  return { owed, owing, net: toCentavos(owing - owed) };
}

/**
 * How many unsettled bills a housemate still has a hand in, either direction.
 *
 * Written for the leave vote, where "₱1,240 outstanding" on its own doesn't
 * say whether that is one forgotten share or five months of avoidance — and
 * the housemate deciding whether to let them go is answering exactly that.
 */
export function openBillCount(bills: BillWithSplits[], userId: string): number {
  return bills.filter((bill) =>
    bill.splits.some(
      (split) =>
        !split.paid &&
        Number(split.amount_owed) > 0 &&
        (split.user_id === userId || bill.created_by === userId)
    )
  ).length;
}

export type SettleUpEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** Positive: this housemate owes me. Negative: I owe them. */
  net: number;
};

/**
 * Who owes whom, netted per housemate — the "settle up" line the Bills screen
 * leads with.
 *
 * Debts here are always between the signed-in user and one other person: a
 * split is owed to whoever is collecting for the bill, so a bill nobody in the
 * pair logged contributes nothing. The collector's own share is not a debt to
 * anybody — they owe it to the electricity company, not to a housemate — which
 * is why neither branch below can match it, and why `summariseBalance` is the
 * one that counts it.
 *
 * Their profile comes from their own split, so a bill whose collector has
 * since left the household falls back to a generic name rather than dropping
 * the debt.
 */
export function settleUp(bills: BillWithSplits[], userId: string): SettleUpEntry[] {
  const totals = new Map<string, SettleUpEntry>();

  const bump = (
    otherId: string,
    profile: { display_name: string; avatar_url: string | null } | null,
    delta: number
  ) => {
    const existing = totals.get(otherId);
    if (existing) {
      existing.net += delta;
      // A later bill may be the one that knows their name.
      if (existing.name === 'Housemate' && profile) existing.name = profile.display_name;
      return;
    }
    totals.set(otherId, {
      userId: otherId,
      name: profile?.display_name ?? 'Housemate',
      avatarUrl: profile?.avatar_url ?? null,
      net: delta,
    });
  };

  for (const bill of bills) {
    const payer = bill.splits.find((split) => split.user_id === bill.created_by);

    for (const split of bill.splits) {
      if (split.paid) continue;
      const amount = Number(split.amount_owed);
      if (amount === 0) continue;

      if (split.user_id === userId && bill.created_by !== userId) {
        bump(bill.created_by, payer?.profile ?? null, -amount);
      } else if (bill.created_by === userId && split.user_id !== userId) {
        bump(split.user_id, split.profile, amount);
      }
    }
  }

  return [...totals.values()]
    // Sub-centavo residue from an uneven split isn't a debt worth showing.
    .filter((entry) => !isSettledAmount(entry.net))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

/**
 * Settled shares across the household, newest first — the "who paid whom"
 * record that `bill_splits.paid_at` has been quietly keeping all along.
 *
 * The collector's own share used to be dropped here, because it was set paid
 * by the act of logging the bill and listing it would report every bill as
 * opening with a payment from someone to themselves. Nothing sets it for them
 * any more, so when it appears it is a payment they actually made and it
 * belongs in the history like any other. It comes back with `payeeId` equal to
 * `payerId`, which is the ledger's way of saying the money went to the biller
 * rather than to a housemate.
 */
export async function fetchLedger(
  householdId: string,
  limit = 50
): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from('bill_splits')
    .select(
      'id, amount_owed, paid_at, user_id, bill:bills!inner(id, title, category, created_by, household_id)'
    )
    .eq('bill.household_id', householdId)
    .eq('paid', true)
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  type Row = {
    id: string;
    amount_owed: number;
    paid_at: string;
    user_id: string;
    bill: {
      id: string;
      title: string;
      category: LedgerEntry['category'];
      created_by: string;
    };
  };

  return ((data ?? []) as unknown as Row[])
    .map((row) => ({
      id: row.id,
      amount: Number(row.amount_owed),
      paidAt: row.paid_at,
      billId: row.bill.id,
      billTitle: row.bill.title,
      category: row.bill.category,
      payerId: row.user_id,
      payeeId: row.bill.created_by,
    }));
}
