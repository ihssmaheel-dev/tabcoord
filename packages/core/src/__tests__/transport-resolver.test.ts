import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('transport resolver', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    // Make resolver think we're in browser
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns noop when no transports available', async () => {
    const { createTransport, destroyTransport } = await import('../transport/resolver.js');
    const t = createTransport('test-resolver');
    expect(t.isAvailable()).toBe(true);
    destroyTransport('test-resolver');
  });
});
