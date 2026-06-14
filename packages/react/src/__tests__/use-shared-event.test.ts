import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharedEvent } from '../use-shared-event.js';
import type { EventBus, BusEvent } from '@tabcoord/core';

function createMockBus(): EventBus & { _emit: (type: string, payload?: unknown) => void } {
  const handlers: Array<{ pattern: string; handler: (event: BusEvent) => void }> = [];
  return {
    _emit(type: string, payload?: unknown) {
      const event: BusEvent = {
        type,
        payload,
        _meta: { id: '1', type, source: 'other-tab', timestamp: Date.now() },
      };
      for (const entry of handlers) {
        if (entry.pattern === type || entry.pattern === '*') {
          entry.handler(event);
        }
      }
    },
    on(pattern: string, handler: (event: BusEvent) => void) {
      handlers.push({ pattern, handler });
      return () => {
        const idx = handlers.findIndex((e) => e.handler === handler);
        if (idx !== -1) handlers.splice(idx, 1);
      };
    },
    emit() {},
    destroy() { handlers.length = 0; },
  };
}

describe('useSharedEvent', () => {
  it('calls handler when matching event is received', () => {
    const bus = createMockBus();
    const handler = vi.fn();

    renderHook(() => useSharedEvent(bus, 'test:event', handler));

    act(() => { bus._emit('test:event', { data: 42 }); });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'test:event', payload: { data: 42 } }),
    );
  });

  it('does not call handler for non-matching events', () => {
    const bus = createMockBus();
    const handler = vi.fn();

    renderHook(() => useSharedEvent(bus, 'test:event', handler));

    act(() => { bus._emit('other:event'); });

    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const bus = createMockBus();
    const handler = vi.fn();

    const { unmount } = renderHook(() => useSharedEvent(bus, 'test:event', handler));

    unmount();

    // After unmount, emitting should not call the handler
    act(() => { bus._emit('test:event'); });
    expect(handler).not.toHaveBeenCalled();
  });

  it('uses latest handler without re-subscribing', () => {
    const bus = createMockBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const { rerender } = renderHook(
      ({ h }) => useSharedEvent(bus, 'test:event', h),
      { initialProps: { h: handler1 } },
    );

    act(() => { bus._emit('test:event'); });
    expect(handler1).toHaveBeenCalledTimes(1);

    // Update handler — should use new one without re-subscribing
    rerender({ h: handler2 });

    act(() => { bus._emit('test:event'); });
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler1).toHaveBeenCalledTimes(1); // still only called once
  });
});
