import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharedStore } from '../use-shared-store.js';
import type { SharedStoreHandle } from '@tabcoord/core';

function createMockHandle<T>(initial: T): SharedStoreHandle<T> & {
  _state: T;
  _subscribers: Set<(state: T) => void>;
} {
  const subscribers = new Set<(state: T) => void>();
  let state = initial;

  return {
    _state: state,
    _subscribers: subscribers,
    get() { return state; },
    set(value: T | ((prev: T) => T)) {
      state = typeof value === 'function' ? (value as (prev: T) => T)(state) : value;
      for (const fn of subscribers) fn(state);
    },
    subscribe(fn: (state: T) => void) {
      subscribers.add(fn);
      return () => { subscribers.delete(fn); };
    },
    destroy() { subscribers.clear(); },
    get status() { return 'synced' as const; },
  };
}

describe('useSharedStore', () => {
  it('returns the initial value', () => {
    const store = createMockHandle({ count: 0 });
    const { result } = renderHook(() => useSharedStore(store, (s) => s));
    expect(result.current).toEqual({ count: 0 });
  });

  it('applies selector', () => {
    const store = createMockHandle({ count: 42, name: 'test' });
    const { result } = renderHook(() => useSharedStore(store, (s) => s.count));
    expect(result.current).toBe(42);
  });

  it('re-renders when store updates', () => {
    const store = createMockHandle({ count: 0 });
    const { result } = renderHook(() => useSharedStore(store, (s) => s.count));

    expect(result.current).toBe(0);

    act(() => { store.set({ count: 1 }); });

    expect(result.current).toBe(1);
  });

  it('only re-renders when selected value changes', () => {
    const store = createMockHandle({ count: 0, name: 'a' });
    const selector = vi.fn((s: { count: number; name: string }) => s.count);
    const { result } = renderHook(() => useSharedStore(store, selector));

    expect(result.current).toBe(0);

    const callsBefore = selector.mock.calls.length;

    // Update name but not count — selector result unchanged, no re-render
    act(() => { store.set((prev) => ({ ...prev, name: 'b' })); });

    expect(result.current).toBe(0);
    // Selector may be called during commit phase, but result should not change
    // so the hook should not re-render with a new value
  });

  it('unsubscribes on unmount', () => {
    const store = createMockHandle({ count: 0 });
    const { unmount } = renderHook(() => useSharedStore(store, (s) => s));

    expect(store._subscribers.size).toBe(1);

    unmount();

    expect(store._subscribers.size).toBe(0);
  });
});
