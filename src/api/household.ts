import { supabase } from '../lib/supabase';
import type { Household, MemberWithProfile, Profile } from '../types';

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

export async function leaveHousehold(householdId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId);

  if (error) throw error;
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
