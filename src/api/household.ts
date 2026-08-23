import type { LeaveVote } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import type {
  Household,
  LeaveRequest,
  LeaveRequestWithVotes,
  MemberWithProfile,
  Profile,
} from '../types';

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export type Membership = {
  household: Household;
  role: 'admin' | 'member';
};

/**
 * The household the user is currently in. Kasama keeps one active household per
 * user — if they somehow belong to several, the earliest joined one wins.
 */
export async function fetchMembership(userId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('role, joined_at, household:households(*)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.household) return null;

  return {
    household: data.household as unknown as Household,
    role: data.role,
  };
}

export async function fetchMembers(householdId: string): Promise<MemberWithProfile[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('*, profile:profiles(*)')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).filter((row) => row.profile) as unknown as MemberWithProfile[];
}

/**
 * Creating a household goes through a SECURITY DEFINER function rather than a
 * direct insert. The app needs the generated invite code back, and Postgres
 * applies the SELECT policy to `RETURNING` rows — which the creator cannot
 * satisfy yet, because the trigger that makes them a member only fires at the
 * end of the statement. The function creates the household and the membership
 * together and returns the row.
 */
export async function createHousehold(name: string): Promise<Household> {
  const { data, error } = await supabase.rpc('create_household', {
    household_name: name.trim(),
  });

  if (error) throw error;
  return data as Household;
}

/**
 * Joining runs through a SECURITY DEFINER function: a user cannot read a
 * household they are not a member of, so they cannot look up the code directly.
 */
export async function joinHouseholdByCode(code: string): Promise<Household> {
  const { data, error } = await supabase.rpc('join_household_by_code', {
    code: code.trim().toUpperCase(),
  });

  if (error) throw error;
  return data as Household;
}

// ---------------------------------------------------------------------------
// Leaving
//
// Leaving used to be one delete: tap, confirm, gone. It is now something the
// house answers, because the person with money outstanding is exactly the one
// most likely to tap it and the housemates left behind found out by noticing a
// name had gone from the split list. Every function below is a thin call over
// a SECURITY DEFINER function — see the leave_requests migration for why the
// rules live down there rather than up here.
// ---------------------------------------------------------------------------

/**
 * Asks the household to let you go.
 *
 * Comes back `completed` straight away when there is nobody left to ask,
 * `pending` otherwise. Asking twice returns the request already open rather
 * than failing, so a double tap is not an error message.
 */
export async function requestLeave(
  householdId: string,
  reason: string | null
): Promise<LeaveRequest> {
  const { data, error } = await supabase.rpc('request_household_leave', {
    target_household: householdId,
    reason: reason?.trim() || null,
  });

  if (error) throw error;
  return data as LeaveRequest;
}

/**
 * Answers someone else's request.
 *
 * A decline ends it there and then, with its note attached — "you still owe me
 * for July's water" is the whole point of asking. An accept only completes the
 * leave once every remaining housemate has given one.
 *
 * Voting again replaces your answer, right up until the request resolves. That
 * is what makes "decline until you pay me back" workable: they settle up, you
 * switch to accept, and nobody starts over.
 */
export async function voteOnLeaveRequest(
  requestId: string,
  decision: LeaveVote,
  note: string | null
): Promise<LeaveRequest> {
  const { data, error } = await supabase.rpc('vote_on_leave_request', {
    request: requestId,
    decision,
    note: note?.trim() || null,
  });

  if (error) throw error;
  return data as LeaveRequest;
}

/** Takes a request back. The person leaving, or an admin clearing the board. */
export async function cancelLeaveRequest(requestId: string): Promise<LeaveRequest> {
  const { data, error } = await supabase.rpc('cancel_leave_request', {
    request: requestId,
  });

  if (error) throw error;
  return data as LeaveRequest;
}

/**
 * Every request still waiting on the household, with who has answered so far.
 *
 * Only the open ones: a declined or withdrawn request is over, and a list that
 * keeps them around turns a screen people visit to answer something into a
 * history nobody asked for. What happened to a resolved request is told to the
 * person it belonged to, on their own screen, and then it is done.
 */
export async function fetchOpenLeaveRequests(
  householdId: string
): Promise<LeaveRequestWithVotes[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*, profile:profiles(*), votes:leave_request_votes(*, voter:profiles(*))')
    .eq('household_id', householdId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as LeaveRequestWithVotes[];
}

/**
 * How the signed-in user's own most recent request ended, whatever that was.
 *
 * Separate from the list above because it answers a different question. The
 * house wants to know what is still open; the person who asked wants to know
 * whether they are out, still waiting, or have been told no and why — and that
 * last one is a resolved row, which the household list deliberately drops.
 */
export async function fetchMyLeaveRequest(
  householdId: string,
  userId: string
): Promise<LeaveRequestWithVotes | null> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*, profile:profiles(*), votes:leave_request_votes(*, voter:profiles(*))')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as unknown as LeaveRequestWithVotes | null;
}

/**
 * Leaves every household the signed-in user belongs to, without a vote.
 *
 * Paired with signing out, which in an app with no password is the end of the
 * person rather than the end of a session — there is nobody for a leave
 * request to resolve to afterwards. The database hands their unpaid shares and
 * open chore turns to the housemates still there; see
 * `20260823000000_sign_out_leaves_household.sql`.
 *
 * `requestLeave` is still the door for somebody who is staying signed in: they
 * are around to be asked about, so the house gets asked.
 */
export async function leaveAllHouseholds(): Promise<number> {
  const { data, error } = await supabase.rpc('leave_all_households');
  if (error) throw error;
  return data ?? 0;
}

export async function renameHousehold(householdId: string, name: string): Promise<Household> {
  const { data, error } = await supabase
    .from('households')
    .update({ name: name.trim() })
    .eq('id', householdId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateDisplayName(userId: string, displayName: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName.trim() })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Removes someone else from the household. Admins only — enforced by the
 * `members leave or be removed by admin` policy, not just by the UI.
 *
 * Their bills and splits stay behind. `bill_splits.user_id` cascades from
 * `profiles`, not from membership, so a removed housemate's debts don't
 * quietly vanish along with them — which is the whole reason anyone would
 * remove a housemate mid-month.
 *
 * Their *unfinished* chore turns do not stay: the `on_household_member_removed`
 * trigger hands them to whoever is next in the rotation, because a turn
 * assigned to someone who has moved out is one nobody is going to do. Finished
 * turns are left exactly where they are — that is the record of what happened.
 */
export async function removeMember(householdId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId);

  if (error) throw error;
}

/** Promotes a housemate to admin, or hands the role back. Admins only. */
export async function setMemberRole(
  householdId: string,
  userId: string,
  role: 'admin' | 'member'
): Promise<void> {
  const { error } = await supabase
    .from('household_members')
    .update({ role })
    .eq('household_id', householdId)
    .eq('user_id', userId);

  if (error) throw error;
}

export type PushPreferences = {
  push_bills: boolean;
  push_chores: boolean;
  push_board: boolean;
};

/** Which kinds of notification this user wants. Their own row only. */
export async function updatePushPreferences(
  userId: string,
  preferences: Partial<PushPreferences>
): Promise<void> {
  const { error } = await supabase.from('profiles').update(preferences).eq('id', userId);
  if (error) throw error;
}
