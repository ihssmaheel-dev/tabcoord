import { describe, it, expect } from 'vitest';

describe('noop transport', () => {
  it('implements Transport interface without side effects', async () => {
    const { createNoopTransport } = await import('../transport/noop.js');
    const t = createNoopTransport();

    expect(t.isAvailable()).toBe(true);
    expect(() => t.send({ any: 'data' })).not.toThrow();
    const unsub = t.onMessage(() => {});
    expect(() => unsub()).not.toThrow();
    expect(() => t.destroy()).not.toThrow();
  });
});
