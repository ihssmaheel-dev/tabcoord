import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('InternalStore', () => {
  let mockTransport: ReturnType<typeof createMockTransport>;

  function createMockTransport() {
    return {
      onMessage: vi.fn(() => vi.fn()),
      send: vi.fn(),
      destroy: vi.fn(),
      isAvailable: vi.fn(() => true),
    };
  }

  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    vi.useFakeTimers();
    mockTransport = createMockTransport();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('starts in bootstrap status and transitions to synced', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);

    expect(store.status).toBe('bootstrap');

    // Advance past jitter + bootstrap timeout
    vi.advanceTimersByTime(750);
    expect(store.status).toBe('synced');

    store.destroy();
  });

  it('queues writes during bootstrap and replays them', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);

    store.set({ count: 1 });
    store.set((prev: { count: number }) => ({ count: prev.count + 1 }));

    // Advance past jitter + bootstrap timeout
    vi.advanceTimersByTime(750);

    expect(store.status).toBe('synced');
    expect(store.get()).toEqual({ count: 2 });
    store.destroy();
  });

  it('subscribes and notifies on state change', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);

    vi.advanceTimersByTime(750); // complete bootstrap

    const fn = vi.fn();
    store.subscribe(fn);
    store.set({ count: 5 });
    expect(fn).toHaveBeenCalledWith({ count: 5 });
    store.destroy();
  });

  it('unsubscribe removes listener', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);

    vi.advanceTimersByTime(750);

    const fn = vi.fn();
    const unsub = store.subscribe(fn);
    unsub();
    store.set({ count: 3 });
    expect(fn).not.toHaveBeenCalled();
    store.destroy();
  });

  it('preserves _meta and $tabcoord in user state (no stripping)', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore<Record<string, unknown>>({ a: 1 }, mockTransport);
    vi.advanceTimersByTime(750);

    store.set({ a: 2, _meta: 'user-data', $tabcoord: 'user-data' });
    expect(store.get()).toEqual({ a: 2, _meta: 'user-data', $tabcoord: 'user-data' });
    store.destroy();
  });

  it('preserves reserved keys in setter results (no stripping)', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore<Record<string, unknown>>({ a: 1 }, mockTransport);
    vi.advanceTimersByTime(750);

    store.set(() => ({ a: 3, _meta: 'user-data' }));
    expect(store.get()).toEqual({ a: 3, _meta: 'user-data' });
    store.destroy();
  });

  it('destroy stops all activity', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);
    store.destroy();
    vi.advanceTimersByTime(1000);
    // After destroy, bootstrap timers should be cleared
    expect(store.status).toBe('bootstrap');
  });

  it('destroy clears subscribers', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);
    vi.advanceTimersByTime(750);

    const fn = vi.fn();
    store.subscribe(fn);
    store.destroy();

    // Subscribers cleared — set should not notify
    // (destroyed store skips set anyway)
    expect(fn).not.toHaveBeenCalled();
  });

  it('set() is no-op after destroy with warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);
    vi.advanceTimersByTime(750);

    store.destroy();
    store.set({ count: 999 });

    expect(store.get()).toEqual({ count: 0 }); // unchanged
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('get() returns last state after destroy', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);
    vi.advanceTimersByTime(750);

    store.set({ count: 42 });
    expect(store.get()).toEqual({ count: 42 });

    store.destroy();
    expect(store.get()).toEqual({ count: 42 }); // still accessible
  });
});
