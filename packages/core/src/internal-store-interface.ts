import type { Clock } from './clock.js';

export interface InternalStoreInterface<T = unknown> {
  get(): T;
  set(value: T | ((prev: T) => T)): void;
  subscribe(fn: (state: T) => void): () => void;
  destroy(): void;
  readonly status: 'bootstrap' | 'synced';
  getClock(): Clock;
}
