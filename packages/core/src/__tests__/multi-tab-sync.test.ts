import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InternalStore } from '../internal-store.js';
import type { Transport } from '../transport/types.js';

/**
 * Creates a shared transport pair — two transports connected to each other.
 * Messages sent on one are received by the other (simulating BroadcastChannel).
 */
function createSharedTransportPair(): [Transport, Transport] {
  const handlersA = new Set<(data: unknown) => void>();
  const handlersB = new Set<(data: unknown) => void>();

  const transportA: Transport = {
    onMessage(handler) {
      handlersA.add(handler);
      return () => { handlersA.delete(handler); };
    },
    send(data) {
      // Deliver to B's handlers (simulating cross-tab)
      for (const h of handlersB) {
        try { h(data); } catch { /* ignore */ }
      }
    },
    destroy() { handlersA.clear(); },
    isAvailable() { return true; },
  };

  const transportB: Transport = {
    onMessage(handler) {
      handlersB.add(handler);
      return () => { handlersB.delete(handler); };
    },
    send(data) {
      // Deliver to A's handlers (simulating cross-tab)
      for (const h of handlersA) {
        try { h(data); } catch { /* ignore */ }
      }
    },
    destroy() { handlersB.clear(); },
    isAvailable() { return true; },
  };

  return [transportA, transportB];
}

describe('multi-tab state sync', () => {
  let tabIdCounter = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    tabIdCounter = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeTabId(): string {
    return `tab-${++tabIdCounter}`;
  }

  it('tab A change reflects in tab B', async () => {
    const idA = makeTabId();
    const idB = makeTabId();
    vi.stubGlobal('crypto', { randomUUID: () => idA });

    const [transportA, transportB] = createSharedTransportPair();

    // Tab A creates store first
    vi.stubGlobal('crypto', { randomUUID: () => idA });
    const storeA = new InternalStore<{ count: number }>(
      { count: 0 }, transportA, undefined, 'sync-test',
    );

    // Tab B creates store second
    vi.stubGlobal('crypto', { randomUUID: () => idB });
    const storeB = new InternalStore<{ count: number }>(
      { count: 0 }, transportB, undefined, 'sync-test',
    );

    // Advance past bootstrap for both
    vi.advanceTimersByTime(1000);

    // Tab A changes state
    storeA.set({ count: 42 });

    // Tab B should receive the update
    expect(storeB.get()).toEqual({ count: 42 });

    storeA.destroy();
    storeB.destroy();
  });

  it('tab B change reflects in tab A', async () => {
    const idA = makeTabId();
    const idB = makeTabId();

    const [transportA, transportB] = createSharedTransportPair();

    vi.stubGlobal('crypto', { randomUUID: () => idA });
    const storeA = new InternalStore<{ count: number }>(
      { count: 0 }, transportA, undefined, 'sync-test-ba',
    );

    vi.stubGlobal('crypto', { randomUUID: () => idB });
    const storeB = new InternalStore<{ count: number }>(
      { count: 0 }, transportB, undefined, 'sync-test-ba',
    );

    vi.advanceTimersByTime(1000);

    // Tab B changes state
    storeB.set({ count: 99 });

    // Tab A should receive the update
    expect(storeA.get()).toEqual({ count: 99 });

    storeA.destroy();
    storeB.destroy();
  });

  it('bidirectional sync — changes propagate both ways', async () => {
    const idA = makeTabId();
    const idB = makeTabId();

    const [transportA, transportB] = createSharedTransportPair();

    vi.stubGlobal('crypto', { randomUUID: () => idA });
    const storeA = new InternalStore<{ count: number }>(
      { count: 0 }, transportA, undefined, 'sync-test-bi',
    );

    vi.stubGlobal('crypto', { randomUUID: () => idB });
    const storeB = new InternalStore<{ count: number }>(
      { count: 0 }, transportB, undefined, 'sync-test-bi',
    );

    vi.advanceTimersByTime(1000);

    // Tab A sets count=10
    storeA.set({ count: 10 });
    expect(storeB.get()).toEqual({ count: 10 });

    // Tab B sets count=20
    storeB.set({ count: 20 });
    expect(storeA.get()).toEqual({ count: 20 });

    // Tab A sets count=30
    storeA.set({ count: 30 });
    expect(storeB.get()).toEqual({ count: 30 });

    storeA.destroy();
    storeB.destroy();
  });

  it('three tabs converge on same state', async () => {
    const idA = makeTabId();
    const idB = makeTabId();
    const idC = makeTabId();

    // Create a 3-way shared transport
    const handlers = [new Set<(d: unknown) => void>(), new Set<(d: unknown) => void>(), new Set<(d: unknown) => void>()];
    const transports: Transport[] = handlers.map((myHandlers, idx) => ({
      onMessage(handler: (data: unknown) => void) {
        myHandlers.add(handler);
        return () => { myHandlers.delete(handler); };
      },
      send(data: unknown) {
        // Deliver to all OTHER tabs
        for (let i = 0; i < handlers.length; i++) {
          if (i === idx) continue;
          for (const h of handlers[i]) {
            try { h(data); } catch { /* ignore */ }
          }
        }
      },
      destroy() { myHandlers.clear(); },
      isAvailable() { return true; },
    }));

    vi.stubGlobal('crypto', { randomUUID: () => idA });
    const storeA = new InternalStore<{ count: number }>(
      { count: 0 }, transports[0], undefined, 'sync-3way',
    );

    vi.stubGlobal('crypto', { randomUUID: () => idB });
    const storeB = new InternalStore<{ count: number }>(
      { count: 0 }, transports[1], undefined, 'sync-3way',
    );

    vi.stubGlobal('crypto', { randomUUID: () => idC });
    const storeC = new InternalStore<{ count: number }>(
      { count: 0 }, transports[2], undefined, 'sync-3way',
    );

    vi.advanceTimersByTime(1000);

    // Tab A sets count=5
    storeA.set({ count: 5 });
    expect(storeB.get()).toEqual({ count: 5 });
    expect(storeC.get()).toEqual({ count: 5 });

    // Tab C sets count=15
    storeC.set({ count: 15 });
    expect(storeA.get()).toEqual({ count: 15 });
    expect(storeB.get()).toEqual({ count: 15 });

    storeA.destroy();
    storeB.destroy();
    storeC.destroy();
  });

  it('updater function syncs correctly across tabs', async () => {
    const idA = makeTabId();
    const idB = makeTabId();

    const [transportA, transportB] = createSharedTransportPair();

    vi.stubGlobal('crypto', { randomUUID: () => idA });
    const storeA = new InternalStore<{ count: number }>(
      { count: 0 }, transportA, undefined, 'sync-test-updater',
    );

    vi.stubGlobal('crypto', { randomUUID: () => idB });
    const storeB = new InternalStore<{ count: number }>(
      { count: 0 }, transportB, undefined, 'sync-test-updater',
    );

    vi.advanceTimersByTime(1000);

    // Tab A uses updater function
    storeA.set((prev) => ({ count: prev.count + 10 }));
    expect(storeB.get()).toEqual({ count: 10 });

    // Tab B uses updater function
    storeB.set((prev) => ({ count: prev.count + 5 }));
    expect(storeA.get()).toEqual({ count: 15 });

    storeA.destroy();
    storeB.destroy();
  });

  it('subscriber notified on cross-tab sync', async () => {
    const idA = makeTabId();
    const idB = makeTabId();

    const [transportA, transportB] = createSharedTransportPair();

    vi.stubGlobal('crypto', { randomUUID: () => idA });
    const storeA = new InternalStore<{ count: number }>(
      { count: 0 }, transportA, undefined, 'sync-test-sub',
    );

    vi.stubGlobal('crypto', { randomUUID: () => idB });
    const storeB = new InternalStore<{ count: number }>(
      { count: 0 }, transportB, undefined, 'sync-test-sub',
    );

    vi.advanceTimersByTime(1000);

    // Subscribe to tab B
    const subFn = vi.fn();
    storeB.subscribe(subFn);

    // Tab A changes — tab B's subscriber should fire
    storeA.set({ count: 7 });
    expect(subFn).toHaveBeenCalledWith({ count: 7 });

    storeA.destroy();
    storeB.destroy();
  });

  it('late-joining tab gets current state from existing tab', async () => {
    const idA = makeTabId();
    const idB = makeTabId();

    const [transportA, transportB] = createSharedTransportPair();

    // Tab A starts first and sets some state
    vi.stubGlobal('crypto', { randomUUID: () => idA });
    const storeA = new InternalStore<{ count: number }>(
      { count: 0 }, transportA, undefined, 'sync-test-late',
    );
    vi.advanceTimersByTime(1000);

    storeA.set({ count: 42 });

    // Tab B starts after tab A is already synced
    vi.stubGlobal('crypto', { randomUUID: () => idB });
    const storeB = new InternalStore<{ count: number }>(
      { count: 0 }, transportB, undefined, 'sync-test-late',
    );
    vi.advanceTimersByTime(1000);

    // Tab B should have received tab A's state during bootstrap
    expect(storeB.get()).toEqual({ count: 42 });

    storeA.destroy();
    storeB.destroy();
  });

  it('no-op set does not trigger sync', async () => {
    const idA = makeTabId();
    const idB = makeTabId();

    const [transportA, transportB] = createSharedTransportPair();

    vi.stubGlobal('crypto', { randomUUID: () => idA });
    const storeA = new InternalStore<{ count: number }>(
      { count: 0 }, transportA, undefined, 'sync-test-noop',
    );

    vi.stubGlobal('crypto', { randomUUID: () => idB });
    const storeB = new InternalStore<{ count: number }>(
      { count: 0 }, transportB, undefined, 'sync-test-noop',
    );

    vi.advanceTimersByTime(1000);

    const subFn = vi.fn();
    storeB.subscribe(subFn);

    // Tab A sets same value — no change, no notification
    storeA.set({ count: 0 });
    expect(subFn).not.toHaveBeenCalled();

    storeA.destroy();
    storeB.destroy();
  });
});
