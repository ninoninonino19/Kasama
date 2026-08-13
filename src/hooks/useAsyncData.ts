import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> = {
  data: T | null;
  /** True only for the very first load — pull-to-refresh uses `refreshing`. */
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  setData: (updater: T | ((current: T | null) => T | null)) => void;
};

/**
 * Small fetch-on-mount helper: first load, pull-to-refresh, silent realtime
 * refreshes and a readable error message, without pulling in a query library.
 */
export function useAsyncData<T>(
  loader: (() => Promise<T>) | null,
  deps: unknown[] = []
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(loader));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (options?: { silent?: boolean; initial?: boolean }) => {
    const current = loaderRef.current;
    if (!current) {
      setLoading(false);
      return;
    }

    if (options?.initial) setLoading(true);
    else if (!options?.silent) setRefreshing(true);

    try {
      const result = await current();
      if (!mounted.current) return;
      setData(result);
      setError(null);
    } catch (caught) {
      if (!mounted.current) return;
      setError(messageFrom(caught));
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!loader) {
      setData(null);
      setLoading(false);
      return;
    }
    void run({ initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      await run({ silent: options?.silent });
    },
    [run]
  );

  return { data, loading, refreshing, error, refresh, setData: setData as AsyncState<T>['setData'] };
}

export function messageFrom(error: unknown): string {
  if (!error) return 'Something went wrong.';
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return 'Something went wrong. Please try again.';
}
