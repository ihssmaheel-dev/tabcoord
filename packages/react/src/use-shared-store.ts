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

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
