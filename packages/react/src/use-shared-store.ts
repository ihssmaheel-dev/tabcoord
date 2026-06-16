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

  // Use useMemo for getSnapshot to avoid stale closure in concurrent mode
  const getSnapshot = useMemo(
    () => () => selectorRef.current(store.get()),
    [store],
  );

  const getServerSnapshot = useCallback(
    () => selectorRef.current(store.get()),
    [store],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
