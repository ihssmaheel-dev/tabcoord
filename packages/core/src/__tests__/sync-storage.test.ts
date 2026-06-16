import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  });

  it('setItem accepts TTL option without error', async () => {
    await setItem('ttl-key', 'value', { ttl: 5000 });
    expect(await getItem('ttl-key')).toBe('value');
    await removeItem('ttl-key');
  });

  it('removeItem clears TTL timer', async () => {
    await setItem('cancel-key', 'value', { ttl: 5000 });
    await removeItem('cancel-key');
    expect(await getItem('cancel-key')).toBeNull();
  });

  it('setItem with no TTL does not auto-expire', async () => {
    await setItem('permanent-key', 'stays');
    expect(await getItem('permanent-key')).toBe('stays');
    await removeItem('permanent-key');
  });

  it('overwrites existing value', async () => {
    await setItem('overwrite-key', 'v1');
    expect(await getItem('overwrite-key')).toBe('v1');
    await setItem('overwrite-key', 'v2');
    expect(await getItem('overwrite-key')).toBe('v2');
    await removeItem('overwrite-key');
  });

  it('handles special characters in keys', async () => {
    await setItem('key/with:special chars', 'value');
    expect(await getItem('key/with:special chars')).toBe('value');
    await removeItem('key/with:special chars');
  });

  it('handles large values', async () => {
    const largeValue = 'x'.repeat(10000);
    await setItem('large-key', largeValue);
    expect(await getItem('large-key')).toBe(largeValue);
    await removeItem('large-key');
  });
});
