import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import { fetchTabSignals } from '../api/signals';
import { useBoardSeen } from '../store/useBoardSeen';
import { useCurrentUserId, useHousehold } from '../store/useSessionStore';
import { useAsyncData } from './useAsyncData';
import { useRealtime } from './useRealtime';

export type TabBadges = {
  /** Overdue bills, as a number on the Bills tab. */
  bills: number;
  /** Whether the board holds a note this device hasn't seen. */
  board: boolean;
};

/**
 * What the tab bar needs to know, kept live for as long as the tabs are
 * mounted.
 *
 * Mounted once in the tabs layout rather than per screen, so the badges are
 * right on the tab you *aren't* looking at — which is the only place a badge
 * does any work.
 */
export function useTabSignals(): TabBadges {
  const household = useHousehold();
  const householdId = household?.id ?? null;
  const userId = useCurrentUserId();

  const seenAt = useBoardSeen((state) => state.seenAt);
  const hydrated = useBoardSeen((state) => state.hydrated);
  const hydrate = useBoardSeen((state) => state.hydrate);

  useEffect(() => {
    if (householdId) void hydrate(householdId);
  }, [householdId, hydrate]);

  const { data, refresh } = useAsyncData(
    householdId ? () => fetchTabSignals(householdId, userId) : null,
    [householdId, userId]
  );

  const silentRefresh = useCallback(() => {
    void refresh({ silent: true });
  }, [refresh]);

  // Realtime covers everything that *changes*, but a bill can fall overdue
  // with nothing written anywhere — the date simply passes. The tabs layout
  // stays mounted for the whole session, so without this the count would be
  // frozen at whatever it was when the app was opened.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') silentRefresh();
    });
    return () => subscription.remove();
  }, [silentRefresh]);

  useRealtime(
    `tab-signals:${householdId ?? 'none'}`,
    householdId
      ? [
          { table: 'bills', filter: `household_id=eq.${householdId}` },
          { table: 'bill_splits' },
          { table: 'announcements', filter: `household_id=eq.${householdId}` },
        ]
      : [],
    silentRefresh
  );

  const latestNoteAt = data?.latestNoteAt ?? null;

  return {
    bills: data?.overdueBills ?? 0,
    // Nothing until the stored timestamp is back: a dot that shows on every
    // cold start and then vanishes is worse than one that arrives a beat late.
    board: hydrated && seenAt !== null && latestNoteAt !== null && latestNoteAt > seenAt,
  };
}
