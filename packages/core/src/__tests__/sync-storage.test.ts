import { describe, it, expect } from 'vitest';
import { setItem, getItem, removeItem } from '../sync-storage.js';

describe('sync-storage', () => {
  it('setItem and getItem round-trip', async () => {
    await setItem('test-key', 'hello');
    const val = await getItem('test-key');
    expect(val).toBe('hello');
    await removeItem('test-key');
    const after = await getItem('test-key');
    expect(after).toBeNull();
  });

  it('getItem returns null for missing key', async () => {
    const val = await getItem('nonexistent');
    expect(val).toBeNull();
  });

  it('removeItem is idempotent', async () => {
    await removeItem('ghost-key');
    // no throw
  });
});
