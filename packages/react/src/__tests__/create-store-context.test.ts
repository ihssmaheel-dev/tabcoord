import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';

const mockStore = {
  _state: { count: 0 } as Record<string, unknown>,
  get() { return this._state; },
  set(value: unknown) {
    if (typeof value === 'function') {
      this._state = (value as (prev: Record<string, unknown>) => Record<string, unknown>)(this._state);
    } else {
      this._state = value as Record<string, unknown>;
    }
  },
  subscribe() { return () => {}; },
  destroy() {},
  get status() { return 'synced' as const; },
};

vi.mock('tabcoord', () => ({
  createSharedStore: vi.fn(() => mockStore),
  createContext: vi.fn(),
}));

const { createStoreContext } = await import('../create-store-context.js');

describe('createStoreContext', () => {
  beforeEach(() => {
    mockStore._state = { count: 0 };
  });

  it('creates Provider and useStore hook', () => {
    const { Provider, useStore } = createStoreContext({
      name: 'test-ctx',
      initial: { count: 0 },
    });

    expect(Provider).toBeDefined();
    expect(useStore).toBeDefined();
  });

  it('useStore returns the store handle', () => {
    const { Provider, useStore } = createStoreContext({
      name: 'test-ctx-access',
      initial: { count: 0 },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(Provider, null, children);

    const { result } = renderHook(() => useStore(), { wrapper });

    expect(result.current).toBeDefined();
    expect(result.current.get()).toEqual({ count: 0 });
  });

  it('exposes store directly', () => {
    const { store } = createStoreContext({
      name: 'test-ctx-direct',
      initial: { value: 'hello' },
    });

    expect(store).toBe(mockStore);
  });

  it('store updates propagate through context', () => {
    const { Provider, useStore } = createStoreContext({
      name: 'test-ctx-update',
      initial: { count: 0 },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(Provider, null, children);

    const { result } = renderHook(() => useStore(), { wrapper });

    expect(result.current.get().count).toBe(0);

    act(() => { result.current.set({ count: 5 }); });

    expect(result.current.get().count).toBe(5);
  });
});
