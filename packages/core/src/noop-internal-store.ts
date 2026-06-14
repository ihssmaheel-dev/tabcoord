import type { InternalStoreInterface } from './internal-store-interface.js';
import type { Clock } from './clock.js';
import { getTabId } from './tab-id.js';

export class NoopInternalStore<T> implements InternalStoreInterface<T> {
  private state: T;
  private clock: Clock = { counter: 0, tabId: getTabId() };
  private subscribers = new Set<(state: T) => void>();

  constructor(initial: T) {
    this.state = initial;
  }

  get(): T {
    return this.state;
  }

  set(value: T | ((prev: T) => T)): void {
    if (typeof value === 'function') {
      this.state = (value as (prev: T) => T)(this.state);
    } else {
      this.state = value;
    }
    for (const fn of this.subscribers) {
      try { fn(this.state); } catch { /* ignore */ }
    }
  }

  subscribe(fn: (state: T) => void): () => void {
    this.subscribers.add(fn);
    return () => { this.subscribers.delete(fn); };
  }

  destroy(): void {
    // no-op
  }

  get status(): 'bootstrap' | 'synced' {
    return 'synced';
  }

  getClock(): Clock {
    return this.clock;
  }
}
