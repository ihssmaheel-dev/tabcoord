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
    const { createTransport, destroyTransport } = await import('../transport/resolver.js');
    const transport = createTransport('test-bc-fallback');

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

    expect(t1).not.toBe(t2);
  });

  it('getTransport returns undefined for unknown name', async () => {
    const { getTransport } = await import('../transport/resolver.js');
    expect(getTransport('nonexistent-name-xyz')).toBeUndefined();
  });

  it('fallback chain: noop when window exists but BC throws', async () => {
    // Simulate BroadcastChannel constructor throwing
    vi.stubGlobal('BroadcastChannel', vi.fn(() => {
      throw new DOMException('not allowed', 'SecurityError');
    }));
    vi.stubGlobal('window', {});

    const { createTransport, destroyTransport } = await import('../transport/resolver.js');
    const transport = createTransport('test-fallback-bc-throw');

    // Should fall through to noop (BC failed, storage-events may also fail in jsdom)
    expect(transport.isAvailable()).toBe(true);
    expect(() => transport.send({})).not.toThrow();

    destroyTransport('test-fallback-bc-throw');
  });

  it('fallback chain: noop when window exists but no BC and no localStorage', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('window', {});
    // Remove localStorage to force noop fallback
    vi.stubGlobal('localStorage', undefined);

    const { createTransport, destroyTransport } = await import('../transport/resolver.js');
    const transport = createTransport('test-fallback-no-storage');

    expect(transport.isAvailable()).toBe(true);
    expect(() => transport.send({})).not.toThrow();

    destroyTransport('test-fallback-no-storage');
  });

  it('transport.send works through full chain', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('window', undefined);

    const { createTransport, destroyTransport } = await import('../transport/resolver.js');
    const transport = createTransport('test-send-chain');

    // Noop transport — send is no-op but should not throw
    expect(() => transport.send({ type: 'test', data: [1, 2, 3] })).not.toThrow();
    expect(() => transport.send(null)).not.toThrow();
    expect(() => transport.send(undefined)).not.toThrow();

    destroyTransport('test-send-chain');
  });

  it('transport.onMessage returns unsubscribe function', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('window', undefined);

    const { createTransport, destroyTransport } = await import('../transport/resolver.js');
    const transport = createTransport('test-unsub');

    const handler = vi.fn();
    const unsub = transport.onMessage(handler);

    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();

    destroyTransport('test-unsub');
  });
});
