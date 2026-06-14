import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('MessageBus', () => {
  let transport: { onMessage: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; isAvailable: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    transport = {
      onMessage: vi.fn(() => vi.fn()),
      send: vi.fn(),
      destroy: vi.fn(),
      isAvailable: vi.fn(() => true),
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emits a message via transport.send', async () => {
    const { MessageBus } = await import('../message-bus.js');
    const bus = new MessageBus(transport);
    bus.emit('heartbeat');
    expect(transport.send).toHaveBeenCalledTimes(1);
    const msg = transport.send.mock.calls[0][0];
    expect(msg._meta.type).toBe('heartbeat');
    bus.destroy();
  });

  it('forwards incoming messages to handlers', async () => {
    const { MessageBus } = await import('../message-bus.js');
    const handler = vi.fn();
    const bus = new MessageBus(transport);

    // Grab the transport's onMessage handler
    const onMsgHandler = transport.onMessage.mock.calls[0][0];

    bus.on('state-patch', handler);
    onMsgHandler({ _meta: { type: 'state-patch' }, payload: { x: 1 } });
    expect(handler).toHaveBeenCalledWith({ _meta: { type: 'state-patch' }, payload: { x: 1 } });

    // Wrong type shouldn't trigger
    onMsgHandler({ _meta: { type: 'heartbeat' } });
    expect(handler).toHaveBeenCalledTimes(1);

    bus.destroy();
  });

  it('stripReservedKeys removes _meta and $tabcoord', async () => {
    const { stripReservedKeys } = await import('../message-bus.js');
    const result = stripReservedKeys({ _meta: 'x', $tabcoord: 'y', a: 1 });
    expect(result).toEqual({ a: 1 });
    expect('_meta' in result).toBe(false);
    expect('$tabcoord' in result).toBe(false);
  });
});
