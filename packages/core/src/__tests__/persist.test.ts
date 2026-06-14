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
});
