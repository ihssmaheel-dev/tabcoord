import type { InternalStoreInterface } from './internal-store-interface.js';
import type { Transport } from './transport/types.js';
import { MessageBus, stripReservedKeys, type WireMessage } from './message-bus.js';
import type { Clock } from './clock.js';
import { tick, compare, serialize, deserialize } from './clock.js';
import { getTabId } from './tab-id.js';
import { persistState } from './persist.js';
import { apply, isPatch, type Patch } from './diff.js';

type Setter<T> = (prev: T) => T;

const BOOTSTRAP_TIMEOUT = 500;
const JITTER_MIN = 50;
const JITTER_MAX = 200;

function jitter(): number {
  return Math.floor(Math.random() * (JITTER_MAX - JITTER_MIN + 1)) + JITTER_MIN;
}

export class InternalStore<T> implements InternalStoreInterface<T> {
  private state: T;
  private clock: Clock = { counter: 0, tabId: getTabId() };
  private _status: 'bootstrap' | 'synced' = 'bootstrap';
  private subscribers = new Set<(state: T) => void>();
  private writeQueue: Array<T | Setter<T>> = [];
  private bus: MessageBus;
  private destroyed = false;
  private outerTimer: ReturnType<typeof setTimeout> | null = null;
  private bootstrapTimer: ReturnType<typeof setTimeout> | null = null;
  private persistPrefix: string | null = null;
  private storeName: string | null = null;

  private _bootstrapPeers = new Set<string>();
  private _bootstrapResponses = 0;

  constructor(
    initial: T,
    transport: Transport,
    private onError?: (err: Error) => void,
    storeName?: string,
    persistPrefix?: string,
  ) {
    this.state = initial;
    this.storeName = storeName ?? null;
    this.persistPrefix = persistPrefix ?? null;
    this.bus = new MessageBus(transport);

    // Handle incoming sync-request from other tabs
    this.bus.on('sync-request', (msg: WireMessage) => {
      const payload = msg.payload as { knownClock?: string; senderTabId?: string } | undefined;
      const senderClock = payload?.knownClock
        ? deserialize(payload.knownClock)
        : null;
      const senderTabId = payload?.senderTabId;

      if (senderTabId) {
        this._bootstrapPeers.add(senderTabId);
      }

      // During bootstrap: only respond if we have a strictly higher clock
      // or same counter but lower tabId (deterministic tiebreak)
      if (this._status === 'bootstrap') {
        if (!senderClock) return;
        const cmp = compare(this.clock, senderClock);
        if (cmp < 0) return; // sender has higher clock, we yield
        if (cmp === 0 && this.clock.tabId > senderClock.tabId) return; // tiebreak: higher tabId yields
        if (cmp === 0 && this.clock.tabId === senderClock.tabId) return; // same tab, ignore
      }

      this.bus.emit('sync-response', {
        state: this.state,
        clock: serialize(this.clock),
        requestedClock: payload?.knownClock,
      }, this.clock);
    });

    // Handle incoming sync-response (we are the joining tab)
    this.bus.on('sync-response', (msg: WireMessage) => {
      if (this._status !== 'bootstrap') return;
      const payload = msg.payload as { state: T; clock: string };
      if (payload.state === undefined) return;
      const incomingClock = deserialize(payload.clock);
      // Accept if incoming clock is strictly higher (more recent state)
      const cmp = compare(incomingClock, this.clock);
      if (cmp <= 0) return; // reject stale or equal state (first responder wins)

      this.state = payload.state;
      this.clock = incomingClock;
      this._bootstrapResponses++;

      // Replay queued writes on top of received state
      this.replayWriteQueue();
      this._status = 'synced';
      this.bus.emit('sync-ack', { tabId: getTabId() }, this.clock);
      this.bus.emit('state-patch', { state: this.state, clock: serialize(this.clock) }, this.clock);
      this.notify();
    });

    // Handle incoming state-patch from other tabs (live sync)
    this.bus.on('state-patch', (msg: WireMessage) => {
      if (this._status !== 'synced') return;
      const payload = msg.payload as { state: T | Patch; clock: string };
      if (payload.state === undefined) return;
      const incomingClock = deserialize(payload.clock);
      const cmp = compare(incomingClock, this.clock);
      if (cmp < 0) return; // reject stale state
      if (cmp === 0) return; // reject same clock (prevents echo loops)

      // Apply patch (diff) or full state replacement
      if (isPatch(payload.state)) {
        this.state = apply(
          this.state as unknown as Record<string, unknown>,
          payload.state as Patch,
        ) as T;
      } else {
        this.state = payload.state as T;
      }

      this.clock = incomingClock;
      if (this.storeName && this.persistPrefix) {
        persistState(this.storeName, this.state, serialize(this.clock), this.persistPrefix);
      }
      this.notify();
    });

    // Begin bootstrap
    this.startBootstrap();
  }

  private replayWriteQueue(): void {
    for (const write of this.writeQueue) {
      if (typeof write === 'function') {
        const resolved = (write as Setter<T>)(this.state);
        this.state = typeof resolved === 'object' && resolved !== null && !Array.isArray(resolved)
          ? (stripReservedKeys(resolved as unknown as Record<string, unknown>) as unknown as T)
          : resolved;
      } else {
        this.state = typeof write === 'object' && write !== null && !Array.isArray(write)
          ? (stripReservedKeys(write as unknown as Record<string, unknown>) as unknown as T)
          : write as T;
      }
    }
    this.writeQueue = [];
  }

  private startBootstrap(): void {
    this.outerTimer = setTimeout(() => {
      if (this.destroyed) return;
      this.bus.emit('sync-request', {
        knownClock: serialize(this.clock),
        senderTabId: getTabId(),
      }, this.clock);

      this.bootstrapTimer = setTimeout(() => {
        if (this.destroyed || this._status === 'synced') return;
        // Timeout — no higher-clock tab responded. We are the leader.
        // Deterministic: if multiple tabs timeout simultaneously,
        // only the one with the lowest tabId becomes leader.
        if (this._bootstrapPeers.size > 0) {
          const allTabs = Array.from(this._bootstrapPeers).concat(getTabId()).sort();
          if (allTabs[0] !== getTabId()) {
            // Another tab has lower ID — wait for it to become leader
            this.bootstrapTimer = setTimeout(() => {
              if (this.destroyed || this._status === 'synced') return;
              // Second timeout — we are the leader after all
              this.becomeLeader();
            }, BOOTSTRAP_TIMEOUT);
            return;
          }
        }
        this.becomeLeader();
      }, BOOTSTRAP_TIMEOUT);
    }, jitter());
  }

  private becomeLeader(): void {
    this.replayWriteQueue();
    this._status = 'synced';
    this.bus.emit('state-patch', { state: this.state, clock: serialize(this.clock) }, this.clock);
    this.notify();
  }

  get(): T {
    return this.state;
  }

  set(value: T | Setter<T>): void {
    if (this.destroyed) {
      console.warn(`[@tabcoord/core] set() called on destroyed store`);
      return;
    }

    if (this._status === 'bootstrap') {
      this.writeQueue.push(value);
      return;
    }

    let next: T;
    if (typeof value === 'function') {
      const resolved = (value as Setter<T>)(this.state);
      next = typeof resolved === 'object' && resolved !== null && !Array.isArray(resolved)
        ? (stripReservedKeys(resolved as unknown as Record<string, unknown>) as unknown as T)
        : resolved;
    } else {
      next = typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (stripReservedKeys(value as unknown as Record<string, unknown>) as unknown as T)
        : value;
    }

    if (JSON.stringify(next) === JSON.stringify(this.state)) return;

    this.clock = tick();
    this.state = next;
    if (this.storeName && this.persistPrefix) {
      persistState(this.storeName, this.state, serialize(this.clock), this.persistPrefix);
    }
    // Send full state for now — diff/patch integration causes bidirectional sync issues
    // The diff/apply module is available for future optimization
    this.bus.emit('state-patch', { state: this.state, clock: serialize(this.clock) }, this.clock);
    this.notify();
  }

  subscribe(fn: (state: T) => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.outerTimer) clearTimeout(this.outerTimer);
    if (this.bootstrapTimer) clearTimeout(this.bootstrapTimer);
    this.bus.destroy();
    this.subscribers.clear();
    this.writeQueue = [];
  }

  get status(): 'bootstrap' | 'synced' {
    return this._status;
  }

  getClock(): Clock {
    return this.clock;
  }

  private notify(): void {
    for (const fn of this.subscribers) {
      try {
        fn(this.state);
      } catch (err) {
        this.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }
}
