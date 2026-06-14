import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('lockManager', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('acquire executes the function', async () => {
    const { lockManager } = await import('../lock-manager.js');
    const lock = lockManager('test-exec');
    const fn = vi.fn();
    await lock.acquire(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    lock.destroy();
  });

  it('acquire releases lock after function completes', async () => {
    const { lockManager } = await import('../lock-manager.js');
    const lock = lockManager('test-release');
    await lock.acquire(() => {});
    await lock.acquire(() => {});
    lock.destroy();
  });

  it('tryAcquire returns true when lock is free', async () => {
    const { lockManager } = await import('../lock-manager.js');
    const lock = lockManager('test-try');
    const fn = vi.fn();
    const result = await lock.tryAcquire(fn);
    expect(result).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    lock.destroy();
  });

  it('reentrant acquire works without deadlock', async () => {
    const { lockManager } = await import('../lock-manager.js');
    const lock = lockManager('test-reentrant');
    let depth = 0;
    await lock.acquire(() => {
      depth++;
      return lock.acquire(() => { depth++; });
    });
    expect(depth).toBe(2);
    lock.destroy();
  });

  it('acquire with async function works', async () => {
    const { lockManager } = await import('../lock-manager.js');
    const lock = lockManager('test-async');
    const fn = vi.fn().mockResolvedValue(undefined);
    await lock.acquire(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    lock.destroy();
  });

  it('destroy cleans up without error', async () => {
    const { lockManager } = await import('../lock-manager.js');
    const lock = lockManager('test-destroy');
    await lock.acquire(() => {});
    lock.destroy();
    lock.destroy();
  });

  it('multiple sequential acquires work', async () => {
    const { lockManager } = await import('../lock-manager.js');
    const lock = lockManager('test-seq');
    const results: number[] = [];
    await lock.acquire(() => { results.push(1); });
    await lock.acquire(() => { results.push(2); });
    await lock.acquire(() => { results.push(3); });
    expect(results).toEqual([1, 2, 3]);
    lock.destroy();
  });
});
