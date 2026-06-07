// React hooks for input debouncing and value throttling.
//
// `useDebounce(value, delay)` returns a stable value that only updates
// `delay` ms after the latest change. Ideal for search inputs that
// trigger expensive operations (DB queries, list re-renders, etc).
//
// `useDebouncedCallback(fn, delay)` returns a memoized callback that
// debounces the underlying function. Good for onChange handlers where
// you don't need the latest debounced value, only a stable callback.

import { useCallback, useEffect, useRef, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export function useDebouncedCallback<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): T {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always keep the latest function in the ref so we can call it from
  // the trailing-edge timer without re-creating the returned callback.
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  // Clear any pending timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fnRef.current(...args);
      }, delay);
    }) as T,
    [delay],
  );
}
