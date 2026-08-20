import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

import { isSupabaseConfigured, supabase } from '../lib/supabase';

type WatchedTable = {
  table: string;
  /** PostgREST filter, e.g. `household_id=eq.<uuid>`. Omit for RLS-only scoping. */
  filter?: string;
};

type Subscription = {
  channel: RealtimeChannel;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setTimeout> | null;
};

/**
 * One entry per distinct stream, shared by every hook instance that asks for
 * it. Home renders the bills, chores and announcements lists alongside the
 * tabs that own them, so the same stream is routinely wanted twice at once.
 */
const subscriptions = new Map<string, Subscription>();

/**
 * Topics are never reused. `supabase.channel()` hands back the existing
 * channel when one is already registered under the same topic, and adding a
 * `postgres_changes` binding to a channel that has subscribed throws — so a
 * rebuild that raced the previous channel's (asynchronous) removal would
 * blow up on the first `.on()`.
 */
let topicCounter = 0;

function acquire(key: string, name: string, tables: WatchedTable[], listener: () => void) {
  let entry = subscriptions.get(key);

  if (!entry) {
    topicCounter += 1;
    const channel = supabase.channel(`${name}#${topicCounter}`);
    const created: Subscription = { channel, listeners: new Set(), timer: null };

    // Bursts are coalesced: inserting a bill with four splits should cause one
    // refetch, not five.
    const schedule = () => {
      if (created.timer) clearTimeout(created.timer);
      created.timer = setTimeout(() => {
        created.timer = null;
        for (const notify of [...created.listeners]) notify();
      }, 250);
    };

    for (const table of tables) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table.table,
          ...(table.filter ? { filter: table.filter } : {}),
        },
        schedule
      );
    }

    channel.subscribe();
    entry = created;
    subscriptions.set(key, created);
  }

  entry.listeners.add(listener);

  return () => {
    const current = subscriptions.get(key);
    if (!current) return;

    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;

    if (current.timer) clearTimeout(current.timer);
    // Dropped before the removal resolves, so the next subscriber builds a
    // fresh channel instead of binding onto this one on its way out.
    subscriptions.delete(key);
    void supabase.removeChannel(current.channel);
  };
}

/**
 * Subscribes to Postgres changes and calls `onChange` when anything relevant
 * moves. Child tables (bill_splits, chore_assignments) have no household_id
 * column to filter on — RLS already limits the stream to the caller's
 * household, so those are subscribed unfiltered.
 *
 * Callers naming the same channel share a single subscription; the last one
 * to unmount tears it down.
 */
export function useRealtime(channelName: string, tables: WatchedTable[], onChange: () => void) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  const key = tables.map((entry) => `${entry.table}:${entry.filter ?? '*'}`).join('|');

  useEffect(() => {
    if (!isSupabaseConfigured || tables.length === 0) return;

    return acquire(`${channelName}|${key}`, channelName, tables, () => callbackRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, key]);
}
