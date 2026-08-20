import { useEffect, useRef } from 'react';

import { useDialog } from '../components/ui/Dialog';
import { hasBeenOfferedPush, markPushOffered, pushSupported, registerForPush } from '../lib/push';
import { useHousehold, useSessionStore } from '../store/useSessionStore';

/**
 * Offers notifications once, on the first launch that reaches the app proper.
 *
 * Deliberately a two-step ask. The OS gives an app exactly one permission
 * dialogue, and spending it before someone knows what Kasama is trades a
 * permanent "no" for a moment's convenience — so this shows an in-app
 * explanation first and only reaches for the system prompt if they say yes.
 * Answering either way marks it done, so it never becomes a nag.
 *
 * Waits for a household: notifications here are about a specific house's bills
 * and chores, and there is nothing to notify anyone about before they join one.
 */
export function usePushOnboarding(): void {
  const dialog = useDialog();
  const status = useSessionStore((state) => state.status);
  const household = useHousehold();
  // One offer per app run, whatever re-renders the layout does.
  const offered = useRef(false);

  useEffect(() => {
    if (offered.current) return;
    if (!pushSupported) return;
    if (status !== 'ready' || !household) return;

    offered.current = true;
    let cancelled = false;

    void (async () => {
      if (await hasBeenOfferedPush()) return;
      if (cancelled) return;

      // Mark before asking: a prompt dismissed by a crash or a backgrounded
      // app shouldn't come back every launch.
      await markPushOffered();

      void dialog({
        title: 'Turn on notifications?',
        message:
          "Kasama can let you know when a bill you owe on is due and when it's your turn on the rota. You can change this any time in Settings.",
        actions: [
          {
            label: 'Turn on',
            onPress: () => {
              // Failure here is not worth interrupting a first launch over —
              // Settings has the same switch and reports errors properly.
              void registerForPush().catch(() => {});
            },
          },
          { label: 'Not now', style: 'cancel' },
        ],
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [dialog, household, status]);
}
