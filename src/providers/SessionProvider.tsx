import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { fetchMembers, fetchMembership, fetchProfile } from '../api/household';
import { messageFrom } from '../hooks/useAsyncData';
import { useRealtime } from '../hooks/useRealtime';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useSessionStore } from '../store/useSessionStore';

type SessionContextValue = {
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-reads profile, household and member list — call after create/join/leave. */
  refreshHousehold: () => Promise<void>;
  bootstrapError: string | null;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const store = useSessionStore;
  const loadingRef = useRef(false);

  const loadHouseholdState = useCallback(async (userId: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const [profile, membership] = await Promise.all([
        fetchProfile(userId),
        fetchMembership(userId),
      ]);

      store.getState().setProfile(profile);
      store.getState().setHousehold(membership?.household ?? null, membership?.role ?? null);

      if (membership) {
        store.getState().setMembers(await fetchMembers(membership.household.id));
      } else {
        store.getState().setMembers([]);
      }
      setBootstrapError(null);
    } catch (error) {
      setBootstrapError(messageFrom(error));
    } finally {
      loadingRef.current = false;
      store.getState().setStatus('ready');
    }
  }, [store]);

  // Initial session + auth state changes.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      store.getState().setStatus('ready');
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      store.getState().setSession(data.session);
      if (data.session) {
        void loadHouseholdState(data.session.user.id);
      } else {
        store.getState().setStatus('ready');
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      const previousUserId = store.getState().userId;
      store.getState().setSession(session);

      if (!session) {
        store.getState().reset();
        store.getState().setStatus('ready');
        return;
      }

      // Token refreshes fire constantly; only reload when the user changes.
      if (session.user.id !== previousUserId || event === 'SIGNED_IN') {
        store.getState().setStatus(previousUserId ? 'ready' : 'loading');
        void loadHouseholdState(session.user.id);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadHouseholdState, store]);

  const userId = useSessionStore((state) => state.userId);
  const householdId = useSessionStore((state) => state.household?.id ?? null);

  const refreshHousehold = useCallback(async () => {
    const currentUserId = store.getState().userId;
    if (!currentUserId) return;
    await loadHouseholdState(currentUserId);
  }, [loadHouseholdState, store]);

  // Keep the roommate list live — someone joining with the invite code should
  // appear without anyone restarting the app.
  useRealtime(
    `members:${householdId ?? 'none'}`,
    householdId ? [{ table: 'household_members', filter: `household_id=eq.${householdId}` }] : [],
    useCallback(() => {
      void refreshHousehold();
    }, [refreshHousehold])
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      bootstrapError,
      refreshHousehold,
      signUp: async (email, password, displayName) => {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (error) throw error;
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        store.getState().reset();
      },
    }),
    [bootstrapError, refreshHousehold, store]
  );

  // `userId` participates so the context identity tracks sign-in/out.
  void userId;

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}
