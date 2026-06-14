import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('broadcast-channel transport', () => {
  let bcInstances: Array<{ name: string; onmessage: unknown; close: () => void }>;

  beforeEach(() => {
    bcInstances = [];
    const BC = vi.fn(function (this: { name: string; onmessage: unknown; close: () => void }, name: string) {
      const inst = { name, onmessage: null, close: vi.fn() };
      bcInstances.push(inst);
      return inst;
    }) as unknown as typeof BroadcastChannel;

    vi.stubGlobal('BroadcastChannel', BC);
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends data via postMessage', async () => {
    const { createBroadcastChannelTransport } = await import('../transport/broadcast-channel.js');
    const t = createBroadcastChannelTransport('test');
    const bc = bcInstances[0];
    bc.postMessage = vi.fn();
    t.send({ hello: 'world' });
    expect(bc.postMessage).toHaveBeenCalledWith({ hello: 'world' });
    t.destroy();
  });

  it('filters own messages by source tabId', async () => {
    const handler = vi.fn();
    const { createBroadcastChannelTransport } = await import('../transport/broadcast-channel.js');
    const t = createBroadcastChannelTransport('test');
    t.onMessage(handler);

    const bc = bcInstances[0];
    const msg = { _meta: { source: 'test-uuid' }, payload: 1 };
    bc.onmessage?.({ data: msg } as MessageEvent);
    expect(handler).not.toHaveBeenCalled();

    const msg2 = { _meta: { source: 'other-tab' }, payload: 2 };
    bc.onmessage?.({ data: msg2 } as MessageEvent);
    expect(handler).toHaveBeenCalledWith(msg2);

    t.destroy();
  });
});
