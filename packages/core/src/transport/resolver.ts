import type { Transport } from './types.js';
import { createBroadcastChannelTransport } from './broadcast-channel.js';
import { createStorageEventTransport } from './storage-events.js';
import { createNoopTransport } from './noop.js';

const _transportCache = new Map<string, Transport>();
const _transportHealth = new Map<string, { lastCheck: number; bcAvailable: boolean }>();
const HEALTH_CHECK_INTERVAL = 5000;

const isBrowser =
  typeof window !== 'undefined' &&
  typeof BroadcastChannel !== 'undefined';

function checkHealth(name: string): void {
  if (!isBrowser) return;
  const cached = _transportCache.get(name);
  if (!cached) return;
  if (cached instanceof (createBroadcastChannelTransport(name) as unknown as Transport).constructor) return;

  const now = Date.now();
  const health = _transportHealth.get(name);
  if (health && now - health.lastCheck < HEALTH_CHECK_INTERVAL) return;

  // Check if BroadcastChannel is now available
  const bcAvailable = typeof BroadcastChannel !== 'undefined';
  _transportHealth.set(name, { lastCheck: now, bcAvailable });

  // If we're on storage-events but BroadcastChannel is now available, switch
  if (bcAvailable && health && !health.bcAvailable) {
    const current = _transportCache.get(name);
    if (current) {
      current.destroy();
      const bcTransport = createBroadcastChannelTransport(name);
      if (bcTransport.isAvailable()) {
        _transportCache.set(name, bcTransport);
      } else {
        bcTransport.destroy();
      }
    }
  }
}

export function createTransport(name: string): Transport {
  const cached = _transportCache.get(name);
  if (cached) {
    checkHealth(name);
    return cached;
  }

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
  _transportHealth.set(name, {
    lastCheck: Date.now(),
    bcAvailable: isBrowser && typeof BroadcastChannel !== 'undefined',
  });
  return transport;
}

export function destroyTransport(name: string): void {
  const t = _transportCache.get(name);
  if (t) {
    t.destroy();
    _transportCache.delete(name);
    _transportHealth.delete(name);
  }
}

export function getTransport(name: string): Transport | undefined {
  return _transportCache.get(name);
}
