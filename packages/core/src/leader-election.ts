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

function hasWebLocks(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.locks !== 'undefined';
}

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
  let webLockAcquired = false;
  let webLockRelease: (() => void) | null = null;

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

  // Fire elected callbacks
  function becomeLeader(): void {
    if (_isLeader || destroyed) return;
    _isLeader = true;
    for (const cb of electedCallbacks) cb();
  }

  // Fire demoted callbacks
  function loseLeadership(): void {
    if (!_isLeader || destroyed) return;
    _isLeader = false;
    for (const cb of demotedCallbacks) cb();
  }

  // Heartbeat-based evaluation (fallback when Web Locks hasn't acquired)
  function evaluate(): void {
    if (destroyed) return;
    // Skip only if Web Locks has successfully acquired the lock
    if (hasWebLocks() && webLockAcquired) return;
    cleanStale();

    const alive = [tabId, ...heard.keys()].sort();
    const newLeader = alive[0] === tabId;

    if (newLeader) {
      becomeLeader();
    } else {
      loseLeadership();
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

  // Web Locks acceleration
  async function tryWebLock(): Promise<void> {
    if (!hasWebLocks() || destroyed) return;

    try {
      // Request the lock — blocks until granted
      const lock = await navigator.locks.request(
        `leader:${name}`,
        { mode: 'exclusive' },
        () => new Promise<void>((resolve) => {
          // Lock held — we are leader
          webLockAcquired = true;
          if (!destroyed) becomeLeader();

          // Wait until released or destroyed
          const check = setInterval(() => {
            if (destroyed) {
              clearInterval(check);
              resolve();
            }
          }, 500);

          // Store release function for cleanup
          webLockRelease = () => {
            clearInterval(check);
            resolve();
          };
        }),
      );

      // Lock was released (tab crashed, navigation, etc.)
      webLockAcquired = false;
      if (!destroyed) {
        loseLeadership();
        // Try to re-acquire after a brief delay
        setTimeout(() => {
          if (!destroyed) tryWebLock();
        }, 100);
      }
    } catch {
      // Lock acquisition failed — fall back to heartbeat
      webLockAcquired = false;
      // evaluate() will handle it on next heartbeat
    }
  }

  // Handle pagehide/visibilitychange for immediate step-down
  function handleVisibilityChange(): void {
    if (destroyed) return;
    if (document.visibilityState === 'hidden' && _isLeader) {
      loseLeadership();
      heard.delete(tabId);
    }
  }

  function handlePageHide(): void {
    if (destroyed) return;
    if (_isLeader) {
      loseLeadership();
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
  }

  // Start: try Web Locks first, fall back to heartbeat-based election
  if (hasWebLocks()) {
    tryWebLock();
  } else {
    // Heartbeat-based: evaluate after timeout
    setTimeout(() => {
      if (!destroyed) evaluate();
    }, timeout);
  }

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
      if (webLockRelease) {
        webLockRelease();
        webLockRelease = null;
      }
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
