import { describe, it, expect } from 'vitest';

describe('error classes', () => {
  it('TabcoordError has correct name and message', async () => {
    const { TabcoordError } = await import('../errors.js');
    const err = new TabcoordError('test message');
    expect(err.name).toBe('TabcoordError');
    expect(err.message).toBe('test message');
    expect(err instanceof Error).toBe(true);
  });

  it('StoreDestroyedError has correct name and message', async () => {
    const { StoreDestroyedError } = await import('../errors.js');
    const err = new StoreDestroyedError('my-store');
    expect(err.name).toBe('StoreDestroyedError');
    expect(err.message).toBe('"my-store" destroyed');
    expect(err instanceof Error).toBe(true);
  });

  it('LockTimeoutError has correct name and message', async () => {
    const { LockTimeoutError } = await import('../errors.js');
    const err = new LockTimeoutError('my-lock');
    expect(err.name).toBe('LockTimeoutError');
    expect(err.message).toBe('"my-lock" timeout');
    expect(err instanceof Error).toBe(true);
  });

  it('LockManagerDestroyedError has correct name', async () => {
    const { LockManagerDestroyedError } = await import('../errors.js');
    const err = new LockManagerDestroyedError();
    expect(err.name).toBe('LockManagerDestroyedError');
    expect(err.message).toBe('LockManager destroyed');
  });

  it('BootstrapTimeoutError has correct name and message', async () => {
    const { BootstrapTimeoutError } = await import('../errors.js');
    const err = new BootstrapTimeoutError('my-store');
    expect(err.name).toBe('BootstrapTimeoutError');
    expect(err.message).toBe('"my-store" bootstrap timeout');
  });

  it('all errors are instanceof TabcoordError', async () => {
    const {
      TabcoordError,
      StoreDestroyedError,
      LockTimeoutError,
      LockManagerDestroyedError,
      BootstrapTimeoutError,
    } = await import('../errors.js');

    expect(new StoreDestroyedError('x') instanceof TabcoordError).toBe(true);
    expect(new LockTimeoutError('x') instanceof TabcoordError).toBe(true);
    expect(new LockManagerDestroyedError() instanceof TabcoordError).toBe(true);
    expect(new BootstrapTimeoutError('x') instanceof TabcoordError).toBe(true);
  });
});
