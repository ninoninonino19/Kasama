import { supabase } from '../lib/supabase';

export type NotifyCategory = 'bills' | 'chores' | 'board';

export type NotifyInput = {
  householdId: string;
  category: NotifyCategory;
  title: string;
  body: string;
  /** Deep-link payload, read when the notification is tapped. */
  data?: Record<string, unknown>;
  /** Narrows delivery — a bill concerns the people who owe on it, not the house. */
  only?: string[] | null;
};

/**
 * Asks the `notify` Edge Function to buzz the household.
 *
 * Always fire-and-forget. A notification is a courtesy attached to an action
 * that has already succeeded — the bill is logged, the note is pinned — so a
 * failure here must never surface as though the action itself failed. It is
 * logged and dropped.
 */
export function notifyHousehold(input: NotifyInput): void {
  void supabase.functions
    .invoke('notify', { body: input })
    .then(({ error }) => {
      if (error) console.warn('notify failed', error.message);
    })
    .catch((error: unknown) => {
      console.warn('notify failed', error);
    });
}
