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
   * Creates the account. Resolves with whether the address still has to be
   * confirmed before it can be used — see the note on the implementation.
   */
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Redeems the six-digit code from the confirmation email; signs them in. */
  confirmEmail: (email: string, code: string) => Promise<void>;
  /** Sends a fresh confirmation code to an address that hasn't confirmed yet. */
  resendConfirmation: (email: string) => Promise<void>;
  /** Emails a six-digit recovery code. Never reveals whether the address exists. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Redeems the code and sets the new password in one step — see the note below. */
  completePasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
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
      signUp: async (email, password, displayName) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (error) throw error;
        return { needsConfirmation: data.session === null };
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      },
      signOut: async () => {
        // Before the session goes, so the next person to log in on a shared
        // phone doesn't inherit the last person's notifications. Best-effort
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
      /**
       * Redeeming the code confirms the address and signs them in, which the
       * auth listener picks up from here — the same one-step shape the
       * recovery flow uses, and for the same reason: a confirmed account with
       * no session is a dead end the user has to climb out of by logging in
       * again.
       */
      confirmEmail: async (email, code) => {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code.trim(),
          type: 'signup',
        });
        if (error) throw error;
      },
      resendConfirmation: async (email) => {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim(),
        });
        if (error) throw error;
      },
      requestPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        // Supabase answers the same way whether or not the address is
        // registered, and so do we — telling a stranger which emails have
        // accounts is a gift to whoever is guessing.
        if (error) throw error;
      },
      /**
       * Verifying the code signs the user in, and `AuthLayout` redirects the
       * moment a session exists. So the code and the new password are taken
       * together and spent in one action: by the time the redirect fires the
       * password is already changed, and the user lands in the app signed in
       * rather than back at a login form.
       */
      completePasswordReset: async (email, code, newPassword) => {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code.trim(),
          type: 'recovery',
        });
        if (verifyError) throw verifyError;

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (updateError) throw updateError;
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
