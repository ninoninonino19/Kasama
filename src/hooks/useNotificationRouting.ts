import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { routeForNotification } from '../lib/push';
import { useHousehold, useSessionStore } from '../store/useSessionStore';

/**
 * Opens the thing a tapped notification is about.
 *
 * Everything Kasama sends carries a `data` payload naming where it came from —
 * a bill, the rota, the board — and without this nobody reads it: tapping
 * "Electricity is due tomorrow" dropped you wherever you last were, which on a
 * phone that has been closed for a day is the home tab, and the bill you were
 * just told about is two taps away.
 *
 * `useLastNotificationResponse` covers both ways a tap arrives: one that woke
 * the app from the background, and one that launched it cold. The cold case is
 * why the session is checked rather than assumed — that response is waiting
 * before there is a session to route against, so this holds it until the
 * household has loaded rather than pushing a bills screen over the welcome
 * screen.
 */
export function useNotificationRouting(): void {
  const router = useRouter();
  const status = useSessionStore((state) => state.status);
  const session = useSessionStore((state) => state.session);
  const household = useHousehold();
  const response = Notifications.useLastNotificationResponse();

  // The hook keeps handing back the same response, so without this a tap would
  // navigate again on every re-render — including one that happens after the
  // user has walked somewhere else.
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    // A dismissal is also a response. Only an actual tap means "take me there".
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (status !== 'ready' || !session || !household) return;

    const identifier = response.notification.request.identifier;
    if (handledRef.current === identifier) return;
    handledRef.current = identifier;

    const route = routeForNotification(response.notification.request.content.data);
    if (route) router.push(route);
  }, [household, response, router, session, status]);
}
