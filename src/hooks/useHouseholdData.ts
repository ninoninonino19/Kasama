import { useCallback } from 'react';

import { fetchAnnouncements } from '../api/announcements';
import { fetchBills, fetchLedger } from '../api/bills';
import { fetchChoreStreaks, fetchChores } from '../api/chores';
import { fetchMyLeaveRequest, fetchOpenLeaveRequests } from '../api/household';
import { useCurrentUserId, useHousehold } from '../store/useSessionStore';
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

/**
 * Requests to leave that the household still has to answer.
 *
 * Watches the votes as well as the requests: the tally on screen is "two of
 * three have said yes", and a housemate answering on their own phone has to
 * move it on everyone else's without anyone pulling to refresh.
 */
export function useOpenLeaveRequests() {
  const household = useHousehold();
  const householdId = household?.id ?? null;

  const state = useAsyncData(
    householdId ? () => fetchOpenLeaveRequests(householdId) : null,
    [householdId]
  );

  const { refresh } = state;
  const silentRefresh = useCallback(() => {
    void refresh({ silent: true });
  }, [refresh]);

  useRealtime(
    `leave-requests:${householdId ?? 'none'}`,
    householdId
      ? [
          { table: 'leave_requests', filter: `household_id=eq.${householdId}` },
          { table: 'leave_request_votes' },
        ]
      : [],
    silentRefresh
  );

  return state;
}

/**
 * The signed-in user's own most recent request, however it ended.
 *
 * Its own hook rather than a filter over the list above, because it has to
 * survive the request resolving — which is exactly when the list drops it, and
 * exactly when the person who asked most wants to know what happened.
 */
export function useMyLeaveRequest() {
  const household = useHousehold();
  const householdId = household?.id ?? null;
  const userId = useCurrentUserId();

  const state = useAsyncData(
    householdId && userId ? () => fetchMyLeaveRequest(householdId, userId) : null,
    [householdId, userId]
  );

  const { refresh } = state;
  const silentRefresh = useCallback(() => {
    void refresh({ silent: true });
  }, [refresh]);

  // No household filter on the requests here. The moment this one is approved
  // the user stops being a member, and a filtered subscription would be
  // evaluated against a membership they no longer have — so the one event that
  // matters most is the one they'd miss. Their own rows stay readable to them
  // either way; see the select policy on `leave_requests`.
  useRealtime(
    `my-leave-request:${userId ?? 'none'}`,
    userId ? [{ table: 'leave_requests', filter: `user_id=eq.${userId}` }] : [],
    silentRefresh
  );

  return state;
}
