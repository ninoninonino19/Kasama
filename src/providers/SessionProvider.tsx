import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { fetchMembers, fetchMembership, fetchProfile } from '../api/household';
import { messageFrom } from '../hooks/useAsyncData';
import { useRealtime } from '../hooks/useRealtime';
import { unregisterFromPush } from '../lib/push';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useBoardSeen } from '../store/useBoardSeen';
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
  const pendingUserIdRef = useRef<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const loadHouseholdState = useCallback((userId: string): Promise<void> => {
    // Whatever prompted this call — a housemate joining, a household created —
    // happened after the in-flight read sent its queries, so that read cannot
    // contain it. Returning here would leave the stale answer on screen until
    // something else happens to ask again, which for a realtime update means
    // the housemate who just joined stays invisible. Queue it instead, and go
    // round once more below.
    //
    // The in-flight pass drains that queue before it resolves, so handing its
    // promise back keeps `await refreshHousehold()` honest: callers navigate
    // and close dialogs on it, and it should not resolve on a read that is
    // known to be one round out of date.
    if (loadingRef.current) {
      pendingUserIdRef.current = userId;
      return inFlightRef.current ?? Promise.resolve();
    }
    loadingRef.current = true;

    const run = (async () => {
      try {
        // Carried rather than assumed: a queued reload can belong to a different
        // person than the one this call started for, if the session changed while
        // the read was out.
        let nextUserId: string | null = userId;

        while (nextUserId) {
          const activeUserId = nextUserId;
          pendingUserIdRef.current = null;

          const [profile, membership] = await Promise.all([
            fetchProfile(activeUserId),
            fetchMembership(activeUserId),
          ]);

          store.getState().setProfile(profile);
          store.getState().setHousehold(membership?.household ?? null, membership?.role ?? null);

          if (membership) {
            store.getState().setMembers(await fetchMembers(membership.household.id));
          } else {
            store.getState().setMembers([]);
          }
          setBootstrapError(null);

          // Anything that arrived while those were in flight.
          nextUserId = pendingUserIdRef.current;
        }
      } catch (error) {
        setBootstrapError(messageFrom(error));
      } finally {
        // A failed pass drops the queue on purpose: the error is on screen, and
        // retrying against a backend that just refused is how a loop starts.
        pendingUserIdRef.current = null;
        inFlightRef.current = null;
        loadingRef.current = false;
        store.getState().setStatus('ready');
      }
    })();

    // Assigned after the call, but before anything can observe it: the body
    // above runs synchronously as far as its first await, and nothing else can
    // reach this function in between.
    inFlightRef.current = run;
    return run;
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

  /**
   * The one membership change the subscription above cannot deliver: your own.
   *
   * When the last housemate accepts your request to leave, the row that
   * disappears is the row that made you a member — and Realtime evaluates the
   * `household_members` policy against a membership you no longer have, so the
   * event never reaches you. You'd keep looking at a household you had left
   * until something else happened to make the app re-read.
   *
   * `leave_requests` stays readable to the person it belongs to after they are
   * out (see the `user_id = auth.uid()` arm of its select policy), so the
   * status flipping to `completed` is the signal that does arrive. Watched here
   * rather than on a screen because it can land while they are anywhere in the
   * app, and what happens next is a route change for the whole session.
   */
  useRealtime(
    `my-membership:${userId ?? 'none'}`,
    userId ? [{ table: 'leave_requests', filter: `user_id=eq.${userId}` }] : [],
    useCallback(() => {
      void refreshHousehold();
    }, [refreshHousehold])
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      bootstrapError,
      refreshHousehold,
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
        if (error) {
          // Anonymous sign-ins are off by default on a Supabase project, and
          // with them off this is the *only* way in, so a fresh project rejects
          // every name typed on the welcome screen. Supabase's own wording
          // ("Anonymous sign-ins are disabled") reads like the app turned them
          // off on purpose, which sends people looking in the wrong place, so
          // say where the switch actually is instead.
          if (error.code === 'anonymous_provider_disabled') {
            throw new Error(
              'This Kasama backend has anonymous sign-ins turned off, so there is no way ' +
                'to open a session. Whoever set up the Supabase project needs to enable ' +
                'Auth → Providers → Anonymous sign-ins.'
            );
          }
          throw error;
        }
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
        // The board's "last seen" mark belongs to the person who was signed
        // in, not to the phone: leaving it would hand the next person a board
        // that claims to have been read.
        useBoardSeen.getState().reset();
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
