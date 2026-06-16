import { useSyncExternalStore, useRef, useCallback, useMemo } from 'react';
import type { SharedStoreHandle } from 'tabcoord';

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

  const getSnapshot = useMemo(
    () => () => {
      const state = store.get();
      return state !== undefined ? selectorRef.current(state) : selectorRef.current(state as T);
    },
    [store],
  );

  const getServerSnapshot = useCallback(
    () => {
      const state = store.get();
      return state !== undefined ? selectorRef.current(state) : selectorRef.current(state as T);
    },
    [store],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
