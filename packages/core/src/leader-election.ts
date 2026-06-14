import { createTransport } from './transport/resolver.js';
import { MessageBus } from './message-bus.js';
import { getTabId } from './tab-id.js';

export interface LeaderElection {
  onElected(cb: () => void): () => void;
  onDemoted(cb: () => void): () => void;
  isLeader: boolean;
  destroy(): void;
}

export interface LeaderElectionOptions {
  heartbeatInterval?: number;
  timeout?: number;
}

interface HeartbeatPayload {
  tabId: string;
  timestamp: number;
}

const DEFAULT_HEARTBEAT_INTERVAL = 2000;
const DEFAULT_TIMEOUT = 5000;

export function leaderElection(
  name: string,
  options?: LeaderElectionOptions,
): LeaderElection {
  const heartbeatInterval = options?.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL;
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  const tabId = getTabId();
  const transport = createTransport(`leader:${name}`);
  const bus = new MessageBus(transport);

  let _isLeader = false;
  let destroyed = false;

  const heard = new Map<string, number>(); // tabId -> last heartbeat timestamp
  const electedCallbacks: Array<() => void> = [];
  const demotedCallbacks: Array<() => void> = [];

  // Clean up stale peers
  function cleanStale(): void {
    const now = Date.now();
    for (const [id, ts] of heard) {
      if (now - ts > timeout) {
        heard.delete(id);
      }
    }
  }

  // Determine if this tab should be leader
  function evaluate(): void {
    if (destroyed) return;
    cleanStale();

    // Collect all alive tabs (including self)
    const alive = [tabId, ...heard.keys()].sort();

    // Leader is the lowest tabId among alive tabs
    const newLeader = alive[0] === tabId;

    if (newLeader && !_isLeader) {
      _isLeader = true;
      for (const cb of electedCallbacks) cb();
    } else if (!newLeader && _isLeader) {
      _isLeader = false;
      for (const cb of demotedCallbacks) cb();
    }
  }

  // Handle heartbeats from other tabs
  const unsubHeartbeat = bus.on('heartbeat', (msg) => {
    const payload = msg.payload as HeartbeatPayload;
    if (payload.tabId === tabId) return;
    heard.set(payload.tabId, payload.timestamp);
    evaluate();
  });

  // Broadcast heartbeat periodically
  const heartbeatTimer = setInterval(() => {
    if (destroyed) return;
    bus.emit('heartbeat', { tabId, timestamp: Date.now() } satisfies HeartbeatPayload);
    evaluate();
  }, heartbeatInterval);

  // Handle pagehide/visibilitychange for immediate step-down
  function handleVisibilityChange(): void {
    if (destroyed) return;
    if (document.visibilityState === 'hidden' && _isLeader) {
      _isLeader = false;
      heard.delete(tabId);
      for (const cb of demotedCallbacks) cb();
    }
  }

  function handlePageHide(): void {
    if (destroyed) return;
    if (_isLeader) {
      _isLeader = false;
      for (const cb of demotedCallbacks) cb();
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
  }

  // Initial evaluation — start as candidate
  // If no other tabs heard after timeout, this tab becomes leader
  setTimeout(() => {
    if (!destroyed) evaluate();
  }, timeout);

  return {
    get isLeader() {
      return _isLeader;
    },

    onElected(cb: () => void): () => void {
      electedCallbacks.push(cb);
      return () => {
        const idx = electedCallbacks.indexOf(cb);
        if (idx !== -1) electedCallbacks.splice(idx, 1);
      };
    },

    onDemoted(cb: () => void): () => void {
      demotedCallbacks.push(cb);
      return () => {
        const idx = demotedCallbacks.indexOf(cb);
        if (idx !== -1) demotedCallbacks.splice(idx, 1);
      };
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      clearInterval(heartbeatTimer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pagehide', handlePageHide);
      }
      unsubHeartbeat();
      bus.destroy();
      heard.clear();
      electedCallbacks.length = 0;
      demotedCallbacks.length = 0;
    },
  };
}
