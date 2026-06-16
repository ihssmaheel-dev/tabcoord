import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('createSharedStore', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('window', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a SharedStoreHandle', async () => {
    const { createSharedStore } = await import('../create-shared-store.js');
    const handle = createSharedStore({ name: 'test', initial: { x: 1 } });
    expect(handle.get()).toEqual({ x: 1 });
    handle.destroy();
  });

  it('supports SSR path (noop internal store)', async () => {
    const { createSharedStore } = await import('../create-shared-store.js');
    const handle = createSharedStore({ name: 'ssr-test', initial: { a: 'b' } });
    expect(handle.status).toBe('synced');
    handle.set({ a: 'c' });
    expect(handle.get()).toEqual({ a: 'c' });
    handle.destroy();
  });

  it('returns stable handle identity across calls (singleton)', async () => {
    const { createSharedStore } = await import('../create-shared-store.js');
    const handle1 = createSharedStore({ name: 'singleton-test', initial: { v: 1 } });
    const handle2 = createSharedStore({ name: 'singleton-test', initial: { v: 2 } });

    // Same reference — stable identity for SSR hydration
    expect(handle1).toBe(handle2);

    handle1.destroy();
  });

  it('re-creation after destroy with same name works', async () => {
    const { createSharedStore } = await import('../create-shared-store.js');
    const handle1 = createSharedStore({ name: 'recreate-test', initial: { v: 1 } });
    expect(handle1.get()).toEqual({ v: 1 });

    handle1.destroy();

    const handle2 = createSharedStore({ name: 'recreate-test', initial: { v: 2 } });
    // New creation should get the fresh initial value
    expect(handle2.get()).toEqual({ v: 2 });

    handle2.destroy();
  });

  it('factory function is called once and cached', async () => {
    const factory = vi.fn(() => ({ ts: Date.now() }));
    const { createSharedStore } = await import('../create-shared-store.js');

    const handle1 = createSharedStore({ name: 'factory-test', initial: factory });
    const firstTs = handle1.get().ts;

    const handle2 = createSharedStore({ name: 'factory-test', initial: factory });

    // Factory called only once (cached for HMR)
    expect(factory).toHaveBeenCalledTimes(1);
    expect(handle2.get().ts).toBe(firstTs);

    handle1.destroy();
  });

  it('static initial values get fresh copies on re-creation', async () => {
    const { createSharedStore } = await import('../create-shared-store.js');

    const handle1 = createSharedStore({ name: 'static-test', initial: { items: [1, 2, 3] } });
    handle1.destroy();

    const handle2 = createSharedStore({ name: 'static-test', initial: { items: [4, 5, 6] } });
    expect(handle2.get()).toEqual({ items: [4, 5, 6] });

    handle2.destroy();
  });
});
