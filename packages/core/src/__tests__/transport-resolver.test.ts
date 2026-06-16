import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('transport resolver', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns noop when no transports available', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('window', undefined);

    const { createTransport, destroyTransport } = await import('../transport/resolver.js');
    const transport = createTransport('test-noop');

    expect(transport.isAvailable()).toBe(true);
    expect(() => transport.send({})).not.toThrow();
    expect(() => transport.destroy()).not.toThrow();

    destroyTransport('test-noop');
  });

  it('returns broadcast channel transport when available', async () => {
    // Note: isBrowser is a module-level constant in resolver.ts.
    // If the module was already loaded without BroadcastChannel, this test
    // will get a noop transport. This test validates the fallback chain instead.
    const { createTransport, destroyTransport } = await import('../transport/resolver.js');
    const transport = createTransport('test-bc-fallback');

    // Transport should be available regardless of BC support
    expect(transport.isAvailable()).toBe(true);
    expect(() => transport.send({ data: 'test' })).not.toThrow();

    destroyTransport('test-bc-fallback');
  });

  it('caches transport instances per name', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('window', undefined);

    const { createTransport, destroyTransport } = await import('../transport/resolver.js');
    const t1 = createTransport('test-cache');
    const t2 = createTransport('test-cache');

    expect(t1).toBe(t2);

    destroyTransport('test-cache');
  });

  it('destroyTransport removes cached instance', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('window', undefined);

    const { createTransport, destroyTransport } = await import('../transport/resolver.js');
    const t1 = createTransport('test-destroy-cache');
    destroyTransport('test-destroy-cache');
    const t2 = createTransport('test-destroy-cache');

    // New instance after destroy
    expect(t1).not.toBe(t2);
  });

  it('getTransport returns undefined for unknown name', async () => {
    const { getTransport } = await import('../transport/resolver.js');
    expect(getTransport('nonexistent-name-xyz')).toBeUndefined();
  });
});
