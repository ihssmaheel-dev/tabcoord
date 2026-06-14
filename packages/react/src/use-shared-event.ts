import { useEffect, useRef, useCallback } from 'react';
import type { EventBus, BusEvent } from '@tabcoord/core';

export function useSharedEvent(
  bus: EventBus,
  event: string,
  handler: (event: BusEvent) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const stableHandler = useCallback(
    (e: BusEvent) => handlerRef.current(e),
    [],
  );

  useEffect(() => {
    const unsub = bus.on(event, stableHandler);
    return () => unsub();
  }, [bus, event, stableHandler]);
}
