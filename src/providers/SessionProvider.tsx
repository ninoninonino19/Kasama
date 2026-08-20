import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { fetchMembers, fetchMembership, fetchProfile } from '../api/household';
import { messageFrom } from '../hooks/useAsyncData';
import { useRealtime } from '../hooks/useRealtime';
import { unregisterFromPush } from '../lib/push';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useSessionStore } from '../store/useSessionStore';

type SessionContextValue = {
  /**
   * Opens a session under `displayName`. That is the whole of signing in.
   *
   * There is no password, so there is nothing to remember and nothing to
   * recover — which is the point: Kasama is gated by the household code, not
   * by an account. The identity lives on this device.
   */
  startSession: (displayName: string) => Promise<void>;
  /** Abandons this device's identity. Irreversible — see the note below. */
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
      /**
       * With "Confirm email" enabled, Supabase creates the user but withholds
       * the session until the address is verified. That missing session — not
       * anything on the user object — is the signal, and it is the same shape
       * whether the address is genuinely new or already belongs to someone:
       * Supabase deliberately answers identically so a stranger can't use this
       * endpoint to discover who has an account. Sending both cases to the
       * confirmation screen keeps that property intact.
       */
      /**
       * An anonymous Supabase user: a real row in `auth.users` with no email
       * and no password. That matters more than it sounds — `auth.uid()` still
       * returns a stable id, so every RLS policy in the schema keeps working
       * exactly as written. Dropping Supabase Auth altogether would have meant
       * relaxing those policies, and the household's bills are not something
       * to leave readable by anyone holding the anon key.
       *
       * The name rides along as user metadata, where `handle_new_user()` picks
       * it up to seed the profile row.
       */
      startSession: async (displayName) => {
        const { error } = await supabase.auth.signInAnonymously({
          options: { data: { display_name: displayName.trim() } },
        });
        if (error) throw error;
      },
      /**
       * Without a password there is no way back in: this identity exists only
       * as the session stored on this device, so clearing it abandons the
       * person. Their bills and splits stay on record under a profile nobody
       * can sign in as. The UI treats this as destructive, and should.
       */
      signOut: async () => {
        // Before the session goes, so the next person on a shared phone
        // doesn't inherit the last person's notifications. Best-effort
        // already, but keep it from blocking the sign-out itself.
        await unregisterFromPush().catch(() => {});

        // A default sign-out revokes the refresh token server-side, which
        // needs the network and fails outright when that token has already
        // expired — exactly the state someone is in when they give up and hit
        // Log out. Falling back to a local sign-out means a session that the
        // server has already forgotten can still be cleared off the device,
        // rather than leaving the user stuck signed in to nothing.
        const { error } = await supabase.auth.signOut();
        if (error) {
          const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
          if (localError) throw localError;
        }

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
