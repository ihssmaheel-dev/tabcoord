import { useSyncExternalStore, useRef, useCallback } from 'react';
import type { SharedStoreHandle } from '@tabcoord/core';

export function useSharedStore<T, R>(
  store: SharedStoreHandle<T>,
  selector: (state: T) => R,
): R {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(onStoreChange),
    [store],
  );

  const getSnapshot = useCallback(
    () => selectorRef.current(store.get()),
    [store],
  );

  // Server snapshot returns selector applied to current store value
  // During SSR this is the NoopInternalStore's initial value (no rehydration)
  // On client this is the real store value (may have rehydrated from localStorage)
  // This ensures server and client render the same thing on first paint
  const getServerSnapshot = useCallback(
    () => selectorRef.current(store.get()),
    [store],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
