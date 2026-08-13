import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import type { Household, MemberWithProfile, Profile } from '../types';

type BootstrapStatus = 'loading' | 'ready';

type SessionState = {
  status: BootstrapStatus;
  session: Session | null;
  profile: Profile | null;
  household: Household | null;
  /** Role of the signed-in user inside `household`. */
  role: 'admin' | 'member' | null;
  members: MemberWithProfile[];

  userId: string | null;

  setStatus: (status: BootstrapStatus) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setHousehold: (household: Household | null, role?: 'admin' | 'member' | null) => void;
  setMembers: (members: MemberWithProfile[]) => void;
  reset: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  status: 'loading',
  session: null,
  profile: null,
  household: null,
  role: null,
  members: [],
  userId: null,

  setStatus: (status) => set({ status }),
  setSession: (session) => set({ session, userId: session?.user.id ?? null }),
  setProfile: (profile) => set({ profile }),
  setHousehold: (household, role = null) => set({ household, role }),
  setMembers: (members) => set({ members }),
  reset: () =>
    set({
      session: null,
      profile: null,
      household: null,
      role: null,
      members: [],
      userId: null,
    }),
}));

/** Convenience selectors — keep components from re-rendering on unrelated state. */
export const useCurrentUserId = () => useSessionStore((state) => state.userId);
export const useHousehold = () => useSessionStore((state) => state.household);
export const useMembers = () => useSessionStore((state) => state.members);
export const useProfile = () => useSessionStore((state) => state.profile);

