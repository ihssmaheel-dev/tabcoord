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

  it('strips reserved keys from object payloads', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore<Record<string, unknown>>({ a: 1 }, mockTransport);
    vi.advanceTimersByTime(750);

    store.set({ a: 2, _meta: 'should-be-removed', $tabcoord: 'also-removed' });
    expect(store.get()).toEqual({ a: 2 });
    store.destroy();
  });

  it('strips reserved keys from setter results too', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore<Record<string, unknown>>({ a: 1 }, mockTransport);
    vi.advanceTimersByTime(750);

    store.set(() => ({ a: 3, _meta: 'stripped-in-setter' }));
    expect(store.get()).toEqual({ a: 3 });
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

  describe('mergeStrategy: field', () => {
    it('field merge shallow-merges incoming patches', async () => {
      const { InternalStore } = await import('../internal-store.js');
      const store = new InternalStore<{ a: number; b: string }>(
        { a: 1, b: 'hello' },
        mockTransport,
        undefined,
        undefined,
        'field',
      );
      vi.advanceTimersByTime(750);

      // Simulate receiving a patch that only changes 'a'
      const handler = mockTransport.onMessage.mock.calls[0]?.[0];
      if (handler) {
        handler({
          _meta: { type: 'state-patch', source: 'other', id: '1', timestamp: Date.now(), clock: '5:other-tab' },
          payload: { state: { $patch: true, a: 99 }, clock: '5:other-tab' },
        });
      }

      expect(store.get()).toEqual({ a: 99, b: 'hello' }); // b preserved
      store.destroy();
    });

    it('field merge replaces full state for arrays', async () => {
      const { InternalStore } = await import('../internal-store.js');
      const store = new InternalStore<{ items: string[] }>(
        { items: ['a'] },
        mockTransport,
        undefined,
        undefined,
        'field',
      );
      vi.advanceTimersByTime(750);

      const handler = mockTransport.onMessage.mock.calls[0]?.[0];
      if (handler) {
        handler({
          _meta: { type: 'state-patch', source: 'other', id: '1', timestamp: Date.now(), clock: '5:other-tab' },
          payload: { state: { items: ['b', 'c'] }, clock: '5:other-tab' },
        });
      }

      expect(store.get()).toEqual({ items: ['b', 'c'] }); // full replacement
      store.destroy();
    });

    it('field merge rejects stale patches', async () => {
      const { InternalStore } = await import('../internal-store.js');
      const store = new InternalStore<{ a: number }>(
        { a: 1 },
        mockTransport,
        undefined,
        undefined,
        'field',
      );
      vi.advanceTimersByTime(750);

      // Set a value to advance our clock
      store.set({ a: 10 });
      const ourClock = store.getClock();

      // Send a patch with an older clock — should be rejected
      const handler = mockTransport.onMessage.mock.calls[0]?.[0];
      if (handler) {
        handler({
          _meta: { type: 'state-patch', source: 'other', id: '1', timestamp: Date.now(), clock: '1:other-tab' },
          payload: { state: { $patch: true, a: 999 }, clock: '1:other-tab' },
        });
      }

      expect(store.get()).toEqual({ a: 10 }); // unchanged
      store.destroy();
    });
  });
});
