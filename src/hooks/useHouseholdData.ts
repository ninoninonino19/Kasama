import { useCallback } from 'react';

import { fetchAnnouncements } from '../api/announcements';
import { fetchBills, fetchLedger } from '../api/bills';
import { fetchChoreStreaks, fetchChores } from '../api/chores';
import { useHousehold } from '../store/useSessionStore';
import { useAsyncData } from './useAsyncData';
import { useRealtime } from './useRealtime';

/** Bills + splits for the current household, kept live across devices. */
export function useBills() {
  const household = useHousehold();
  const householdId = household?.id ?? null;

  const state = useAsyncData(
    householdId ? () => fetchBills(householdId) : null,
    [householdId]
  );

  const { refresh } = state;
  const silentRefresh = useCallback(() => {
    void refresh({ silent: true });
  }, [refresh]);

  useRealtime(
    `bills:${householdId ?? 'none'}`,
    householdId
      ? [{ table: 'bills', filter: `household_id=eq.${householdId}` }, { table: 'bill_splits' }]
      : [],
    silentRefresh
  );

  return state;
}

/** Every settled share in the household, newest first. */
export function useLedger(limit = 50) {
  const household = useHousehold();
  const householdId = household?.id ?? null;

  const state = useAsyncData(
    householdId ? () => fetchLedger(householdId, limit) : null,
    [householdId, limit]
  );

  const { refresh } = state;
  const silentRefresh = useCallback(() => {
    void refresh({ silent: true });
  }, [refresh]);

  useRealtime(
    `ledger:${householdId ?? 'none'}`,
    householdId ? [{ table: 'bill_splits' }] : [],
    silentRefresh
  );

  return state;
}

/** Chores + assignments for the current household. */
export function useChores() {
  const household = useHousehold();
  const householdId = household?.id ?? null;

  const state = useAsyncData(
    householdId ? () => fetchChores(householdId) : null,
    [householdId]
  );

  const { refresh } = state;
  const silentRefresh = useCallback(() => {
    void refresh({ silent: true });
  }, [refresh]);

  useRealtime(
    `chores:${householdId ?? 'none'}`,
    householdId
      ? [
          { table: 'chores', filter: `household_id=eq.${householdId}` },
          { table: 'chore_assignments' },
        ]
      : [],
    silentRefresh
  );

  return state;
}

/**
 * Consecutive finished turns per housemate, from the `chore_streaks` view.
 *
 * Its own query rather than a field on `useChores`: the view already
 * aggregates the whole history, and folding it into the chores fetch would
 * mean re-reading every assignment twice. It listens to the same tables, so a
 * ticked chore updates the streak without a manual refresh.
 */
export function useChoreStreaks() {
  const household = useHousehold();
  const householdId = household?.id ?? null;

  const state = useAsyncData(
    householdId ? () => fetchChoreStreaks(householdId) : null,
    [householdId]
  );

  const { refresh } = state;
  const silentRefresh = useCallback(() => {
    void refresh({ silent: true });
  }, [refresh]);

  useRealtime(
    `chore-streaks:${householdId ?? 'none'}`,
    householdId
      ? [
          { table: 'chores', filter: `household_id=eq.${householdId}` },
          { table: 'chore_assignments' },
        ]
      : [],
    silentRefresh
  );

  return state;
}

/** Household feed, newest first. */
export function useAnnouncements(limit = 50) {
  const household = useHousehold();
  const householdId = household?.id ?? null;

  const state = useAsyncData(
    householdId ? () => fetchAnnouncements(householdId, limit) : null,
    [householdId, limit]
  );

  const { refresh } = state;
  const silentRefresh = useCallback(() => {
    void refresh({ silent: true });
  }, [refresh]);

  useRealtime(
    `announcements:${householdId ?? 'none'}`,
    householdId
      ? [{ table: 'announcements', filter: `household_id=eq.${householdId}` }]
      : [],
    silentRefresh
  );

  return state;
}
