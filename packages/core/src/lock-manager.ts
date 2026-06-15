import { createTransport } from './transport/resolver.js';
import { MessageBus, type WireMessage } from './message-bus.js';
import { getTabId } from './tab-id.js';

export interface LockManager {
  acquire(fn: () => Promise<void> | void, options?: { timeout?: number }): Promise<void>;
  tryAcquire(fn: () => Promise<void> | void): Promise<boolean>;
  destroy(): void;
}

export interface LockManagerOptions {
  ttl?: number;
}

const DEFAULT_TTL = 30_000;

interface LockRequestPayload {
  lockName: string;
  tabId: string;
  requestId: string;
}

interface LockGrantPayload {
  lockName: string;
  requestId: string;
  grantedTo: string;
}

interface LockReleasePayload {
  lockName: string;
}

export function lockManager(name: string, options?: LockManagerOptions): LockManager {
  const ttl = options?.ttl ?? DEFAULT_TTL;
  const tabId = getTabId();
  const transport = createTransport(`lock:${name}`);
  const bus = new MessageBus(transport);

  let destroyed = false;

  // Queue of pending requests from other tabs (FIFO)
  const pendingRequests: Array<{ tabId: string; requestId: string }> = [];

  // Tabs currently holding the lock (for reentrancy tracking)
  const holders = new Map<string, number>(); // tabId -> reentrancy count

  // Pending acquire promises from this tab
  const pendingAcquires: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout> | null;
  }> = [];

  // TTL timer for current holder
  let ttlTimer: ReturnType<typeof setTimeout> | null = null;

  function isLocked(): boolean {
    return holders.size > 0;
  }

  function isHeldByThisTab(): boolean {
    return (holders.get(tabId) ?? 0) > 0;
  }

  function grantLock(toTabId: string): void {
    bus.emit('lock-grant', {
      lockName: name,
      requestId: '',
      grantedTo: toTabId,
    } satisfies LockGrantPayload);
  }

  function releaseLock(): void {
    bus.emit('lock-release', { lockName: name } satisfies LockReleasePayload);
    clearTTL();
  }

  function clearTTL(): void {
    if (ttlTimer) {
      clearTimeout(ttlTimer);
      ttlTimer = null;
    }
  }

  function startTTL(): void {
    clearTTL();
    ttlTimer = setTimeout(() => {
      // TTL expired — force release
      holders.delete(tabId);
      releaseLock();
      // Grant to next in queue
      if (pendingRequests.length > 0) {
        const next = pendingRequests.shift()!;
        holders.set(next.tabId, 1);
        grantLock(next.tabId);
        startTTL();
      }
    }, ttl);
  }

  // Handle lock requests from other tabs
  const unsubRequest = bus.on('lock-request', (msg: WireMessage) => {
    if (destroyed) return;
    const payload = msg.payload as LockRequestPayload;
    if (payload.tabId === tabId) return; // ignore own requests

    if (!isLocked()) {
      // Lock is free — grant immediately
      holders.set(payload.tabId, 1);
      grantLock(payload.tabId);
      startTTL();
    } else {
      // Lock is held — enqueue
      pendingRequests.push({ tabId: payload.tabId, requestId: payload.requestId });
    }
  });

  // Handle lock grants (this tab received the lock)
  const unsubGrant = bus.on('lock-grant', (msg: WireMessage) => {
    if (destroyed) return;
    const payload = msg.payload as LockGrantPayload;
    if (payload.grantedTo !== tabId) return;

    holders.set(tabId, 1);
    startTTL();

    // Resolve the oldest pending acquire
    const pending = pendingAcquires.shift();
    if (pending) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.resolve();
    }
  });

  // Handle lock releases from other tabs
  const unsubRelease = bus.on('lock-release', (msg: WireMessage) => {
    if (destroyed) return;
    const payload = msg.payload as LockReleasePayload;
    if (payload.lockName !== name) return;

    // A tab released — clear its holder entry and grant to next in queue
    // Find and remove the releasing tab from holders
    for (const [holderTabId] of holders) {
      if (holderTabId !== tabId) {
        holders.delete(holderTabId);
        break;
      }
    }

    // Grant to next in queue if lock is now free
    if (!isLocked() && pendingRequests.length > 0) {
      const next = pendingRequests.shift()!;
      holders.set(next.tabId, 1);
      grantLock(next.tabId);
      startTTL();
    }
  });

  return {
    async acquire(
      fn: () => Promise<void> | void,
      options?: { timeout?: number },
    ): Promise<void> {
      if (destroyed) throw new Error('LockManager destroyed');

      // Reentrancy: already holding the lock
      if (isHeldByThisTab()) {
        holders.set(tabId, (holders.get(tabId) ?? 0) + 1);
        try {
          await fn();
        } finally {
          const count = (holders.get(tabId) ?? 1) - 1;
          if (count <= 0) {
            holders.delete(tabId);
          } else {
            holders.set(tabId, count);
          }
        }
        return;
      }

      // Request the lock
      return new Promise<void>((resolve, reject) => {
        const requestId = `${tabId}:${Date.now()}`;
        let timer: ReturnType<typeof setTimeout> | null = null;

        if (options?.timeout) {
          timer = setTimeout(() => {
            const idx = pendingAcquires.findIndex((p) => p.resolve === resolve);
            if (idx !== -1) pendingAcquires.splice(idx, 1);
            reject(new Error('Lock acquire timeout'));
          }, options.timeout);
        }

        pendingAcquires.push({ resolve, reject, timer });
        bus.emit('lock-request', {
          lockName: name,
          tabId,
          requestId,
        } satisfies LockRequestPayload);

        // If lock is already free (we're the only tab), grant to ourselves
        if (!isLocked() && pendingRequests.length === 0) {
          holders.set(tabId, 1);
          startTTL();
          const pending = pendingAcquires.shift();
          if (pending) {
            if (pending.timer) clearTimeout(pending.timer);
            pending.resolve();
          }
        }
      }).then(async () => {
        try {
          await fn();
        } finally {
          const count = (holders.get(tabId) ?? 1) - 1;
          if (count <= 0) {
            holders.delete(tabId);
            releaseLock();
            // Grant to next in queue
            if (pendingRequests.length > 0) {
              const next = pendingRequests.shift()!;
              holders.set(next.tabId, 1);
              grantLock(next.tabId);
              startTTL();
            }
          } else {
            holders.set(tabId, count);
          }
        }
      });
    },

    async tryAcquire(
      fn: () => Promise<void> | void,
    ): Promise<boolean> {
      if (destroyed) return false;

      if (isLocked() && !isHeldByThisTab()) {
        return false;
      }

      await this.acquire(fn);
      return true;
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      clearTTL();
      unsubRequest();
      unsubGrant();
      unsubRelease();
      bus.destroy();
      pendingRequests.length = 0;
      holders.clear();
      for (const p of pendingAcquires) {
        if (p.timer) clearTimeout(p.timer);
        p.reject(new Error('LockManager destroyed'));
      }
      pendingAcquires.length = 0;
    },
  };
}
