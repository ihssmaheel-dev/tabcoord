import type { Transport } from './types.js';
import { createBroadcastChannelTransport } from './broadcast-channel.js';
import { createStorageEventTransport } from './storage-events.js';
import { createNoopTransport } from './noop.js';

const _transportCache = new Map<string, Transport>();

const isBrowser =
  typeof window !== 'undefined' &&
  typeof BroadcastChannel !== 'undefined';

export function createTransport(name: string): Transport {
  const cached = _transportCache.get(name);
  if (cached) return cached;

  let transport: Transport;

  if (isBrowser) {
    const probe = createBroadcastChannelTransport(name);
    if (probe.isAvailable()) {
      transport = probe;
    } else {
      probe.destroy();
      const storageProbe = createStorageEventTransport(name);
      if (storageProbe.isAvailable()) {
        transport = storageProbe;
      } else {
        storageProbe.destroy();
        transport = createNoopTransport();
      }
    }
  } else {
    transport = createNoopTransport();
  }

  _transportCache.set(name, transport);
  return transport;
}

export function destroyTransport(name: string): void {
  const t = _transportCache.get(name);
  if (t) {
    t.destroy();
    _transportCache.delete(name);
  }
}

export function getTransport(name: string): Transport | undefined {
  return _transportCache.get(name);
}
