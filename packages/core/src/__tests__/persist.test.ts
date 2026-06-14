import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('persist', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persistState and rehydrateState round-trip', async () => {
    const { persistState, rehydrateState, clearPersistedState } = await import('../persist.js');
    persistState('test', { a: 1, b: 'x' }, '3:test-uuid');
    const result = rehydrateState('test');
    expect(result).toEqual({ state: { a: 1, b: 'x' }, clock: '3:test-uuid' });
    clearPersistedState('test');
  });

  it('rehydrateState returns undefined for missing key', async () => {
    const { rehydrateState } = await import('../persist.js');
    const result = rehydrateState('nonexistent');
    expect(result).toBeUndefined();
  });

  it('rehydrateState handles corrupted JSON', async () => {
    const { rehydrateState } = await import('../persist.js');
    localStorage.setItem('tabcoord:v1:nonexistent:state', 'not-json');
    const result = rehydrateState('nonexistent');
    expect(result).toBeUndefined();
  });

  it('rehydrateState clears corrupted key from localStorage', async () => {
    const { rehydrateState } = await import('../persist.js');
    localStorage.setItem('tabcoord:v1:corrupt:state', '{bad json');
    const result = rehydrateState('corrupt');
    expect(result).toBeUndefined();
    // Key should be removed
    expect(localStorage.getItem('tabcoord:v1:corrupt:state')).toBeNull();
  });

  it('rehydrateState handles missing version field', async () => {
    const { rehydrateState } = await import('../persist.js');
    localStorage.setItem('tabcoord:v1:badver:state', JSON.stringify({ state: {}, clock: '0:x' }));
    const result = rehydrateState('badver');
    expect(result).toBeUndefined();
  });

  it('persistState silently handles QuotaExceededError', async () => {
    const { persistState } = await import('../persist.js');
    const original = localStorage.setItem;
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    // Should not throw
    persistState('quota-test', { a: 1 }, '0:x');
    localStorage.setItem = original;
  });

  it('persistState silently handles SecurityError', async () => {
    const { persistState } = await import('../persist.js');
    const original = localStorage.setItem;
    localStorage.setItem = () => { const e = new Error('SecurityError'); e.name = 'SecurityError'; throw e; };
    // Should not throw
    persistState('security-test', { a: 1 }, '0:x');
    localStorage.setItem = original;
  });
});
