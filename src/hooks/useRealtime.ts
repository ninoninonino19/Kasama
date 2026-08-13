import { useEffect, useRef } from 'react';

import { isSupabaseConfigured, supabase } from '../lib/supabase';

type WatchedTable = {
  table: string;
  /** PostgREST filter, e.g. `household_id=eq.<uuid>`. Omit for RLS-only scoping. */
  filter?: string;
};

/**
 * Subscribes to Postgres changes and calls `onChange` when anything relevant
 * moves. Child tables (bill_splits, chore_assignments) have no household_id
 * column to filter on — RLS already limits the stream to the caller's
 * household, so those are subscribed unfiltered.
 *
 * Bursts are coalesced: inserting a bill with four splits should cause one
 * refetch, not five.
 */
export function useRealtime(channelName: string, tables: WatchedTable[], onChange: () => void) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  const key = tables.map((entry) => `${entry.table}:${entry.filter ?? '*'}`).join('|');

  useEffect(() => {
    if (!isSupabaseConfigured || tables.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => callbackRef.current(), 250);
    };

    const channel = supabase.channel(channelName);

    for (const entry of tables) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: entry.table,
          ...(entry.filter ? { filter: entry.filter } : {}),
        },
        schedule
      );
    }

    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, key]);
}
