import type { InternalStoreInterface } from './internal-store-interface.js';
import type { Transport } from './transport/types.js';
import { MessageBus, stripReservedKeys, type WireMessage } from './message-bus.js';
import type { Clock } from './clock.js';
import { tick, serialize, deserialize } from './clock.js';
import { getTabId } from './tab-id.js';
import { persistState } from './persist.js';

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
  private bootstrapTimer: ReturnType<typeof setTimeout> | null = null;
  private persistPrefix: string | null = null;

  constructor(
    initial: T,
    transport: Transport,
    private onError?: (err: Error) => void,
    persistPrefix?: string,
  ) {
    this.state = initial;
    this.persistPrefix = persistPrefix ?? null;
    this.bus = new MessageBus(transport);

    // Handle incoming sync-request from other tabs
    this.bus.on('sync-request', (msg: WireMessage) => {
      if (this._status !== 'synced') return;
      const payload = msg.payload as { knownClock?: string } | undefined;
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
      if (payload.state !== undefined) {
        this.state = payload.state;
        this.clock = deserialize(payload.clock);
      }
      // Replay queued writes on top of received state
      for (const write of this.writeQueue) {
        if (typeof write === 'function') {
          this.state = (write as Setter<T>)(this.state);
        } else {
          this.state = write as T;
        }
      }
      this.writeQueue = [];
      this._status = 'synced';
      this.bus.emit('sync-ack', { tabId: getTabId() }, this.clock);
    });

    // Begin bootstrap
    this.startBootstrap();
  }

  private startBootstrap(): void {
    setTimeout(() => {
      if (this.destroyed) return;
      this.bus.emit('sync-request', { knownClock: serialize(this.clock) }, this.clock);

      this.bootstrapTimer = setTimeout(() => {
        if (this.destroyed || this._status === 'synced') return;
        // Timeout — we are the first tab (or no one answered)
        this._status = 'synced';
        const queued = this.writeQueue;
        this.writeQueue = [];
        for (const write of queued) {
          if (typeof write === 'function') {
            this.state = (write as Setter<T>)(this.state);
          } else {
            this.state = write as T;
          }
        }
        this.notify();
      }, BOOTSTRAP_TIMEOUT);
    }, jitter());
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

    this.clock = tick();
    this.state = next;
    if (this.persistPrefix) {
      persistState(this.persistPrefix, this.state, serialize(this.clock));
    }
    this.bus.emit('state-patch', { state: this.state, clock: serialize(this.clock) }, this.clock);
    this.notify();
  }

  subscribe(fn: (state: T) => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  destroy(): void {
    this.destroyed = true;
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
