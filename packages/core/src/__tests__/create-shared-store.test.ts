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
});
