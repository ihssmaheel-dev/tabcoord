import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('eventBus', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    vi.stubGlobal('BroadcastChannel', vi.fn(() => ({
      postMessage: vi.fn(),
      close: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('on and emit work correctly', async () => {
    const { eventBus } = await import('../event-bus.js');
    const bus = eventBus('test');

    const received: unknown[] = [];
    bus.on('test-event', (e) => { received.push(e.payload); });

    bus.emit('test-event', { x: 1 });
    // Local handlers receive own emissions
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ x: 1 });

    bus.destroy();
  });

  it('eventBus follows EventBus interface', async () => {
    const { eventBus } = await import('../event-bus.js');
    const bus = eventBus('test3');
    expect(typeof bus.on).toBe('function');
    expect(typeof bus.emit).toBe('function');
    expect(typeof bus.destroy).toBe('function');
    bus.destroy();
  });

  it('supports wildcard pattern registration', async () => {
    const { eventBus } = await import('../event-bus.js');
    const bus = eventBus('test4');
    expect(() => bus.on('cart:*', () => {})).not.toThrow();
    expect(() => bus.on('*', () => {})).not.toThrow();
    bus.destroy();
  });
});
