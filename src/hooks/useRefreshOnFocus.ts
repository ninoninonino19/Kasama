import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Refetches when a screen comes back into view — after closing the "new bill"
 * modal, for instance. Realtime usually beats it to the punch, but this makes
 * "I just added that, where is it?" impossible rather than merely unlikely.
 *
 * The first focus is skipped: the screen has only just loaded its data.
 */
export function useRefreshOnFocus(refresh: (options?: { silent?: boolean }) => Promise<void>) {
  const isFirstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      void refresh({ silent: true });
    }, [refresh])
  );
}
