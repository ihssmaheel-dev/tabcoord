import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('InternalStore', () => {
  let mockTransport: ReturnType<typeof createMockTransport>;
  let messageHandlers: Map<string, Array<(msg: unknown) => void>>;

  function createMockTransport() {
    messageHandlers = new Map();
    return {
      onMessage: vi.fn((handler: (data: unknown) => void) => {
        // Capture the handler so we can simulate incoming messages
        const type = 'default';
        if (!messageHandlers.has(type)) messageHandlers.set(type, []);
        messageHandlers.get(type)!.push(handler);
        return vi.fn(); // unsubscribe
      }),
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

    vi.advanceTimersByTime(750);
    expect(store.status).toBe('synced');

    store.destroy();
  });

  it('queues writes during bootstrap and replays them', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);

    store.set({ count: 1 });
    store.set((prev: { count: number }) => ({ count: prev.count + 1 }));

    vi.advanceTimersByTime(750);

    expect(store.status).toBe('synced');
    expect(store.get()).toEqual({ count: 2 });
    store.destroy();
  });

  it('subscribes and notifies on state change', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);

    vi.advanceTimersByTime(750);

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
    expect(store.status).toBe('bootstrap');
  });

  it('destroy clears subscribers', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);
    vi.advanceTimersByTime(750);

    const fn = vi.fn();
    store.subscribe(fn);
    store.destroy();

    expect(fn).not.toHaveBeenCalled();
  });

  it('set() is no-op after destroy with error callback', async () => {
    const onError = vi.fn();
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport, onError);
    vi.advanceTimersByTime(750);

    store.destroy();
    store.set({ count: 999 });

    expect(store.get()).toEqual({ count: 0 });
    expect(onError).toHaveBeenCalled();
  });

  it('get() returns last state after destroy', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);
    vi.advanceTimersByTime(750);

    store.set({ count: 42 });
    expect(store.get()).toEqual({ count: 42 });

    store.destroy();
    expect(store.get()).toEqual({ count: 42 });
  });

  it('onError callback fires when subscriber throws', async () => {
    const onError = vi.fn();
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport, onError);
    vi.advanceTimersByTime(750);

    store.subscribe(() => { throw new Error('subscriber crash'); });
    store.set({ count: 1 });

    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][0].message).toBe('subscriber crash');
    store.destroy();
  });

  it('shallow equality check prevents unnecessary notifications', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);
    vi.advanceTimersByTime(750);

    const fn = vi.fn();
    store.subscribe(fn);

    // Set same value — should not notify
    store.set({ count: 0 });
    expect(fn).not.toHaveBeenCalled();

    // Set different value — should notify
    store.set({ count: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
    store.destroy();
  });

  it('getClock returns current clock', async () => {
    const { InternalStore } = await import('../internal-store.js');
    const store = new InternalStore({ count: 0 }, mockTransport);

    const clock = store.getClock();
    expect(clock).toHaveProperty('counter');
    expect(clock).toHaveProperty('tabId');
    expect(typeof clock.counter).toBe('number');
    expect(typeof clock.tabId).toBe('string');
    store.destroy();
  });
});
