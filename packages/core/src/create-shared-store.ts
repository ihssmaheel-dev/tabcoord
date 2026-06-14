import { SharedStoreHandle } from './shared-store-handle.js';
import { InternalStore } from './internal-store.js';
import { NoopInternalStore } from './noop-internal-store.js';
import { setInstance } from './instance-cache.js';
import { resolveInitial } from './resolve-initial.js';
import { createTransport } from './transport/resolver.js';
import type { PersistConfig } from './resolve-initial.js';

export interface CreateSharedStoreOptions<T = unknown> {
  name: string;
  initial: T | (() => T);
  mergeStrategy?: 'whole' | 'field';
  persist?: PersistConfig<T>;
  onError?: (err: Error) => void;
}

const isBrowser =
  typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined';

export function createSharedStore<T>(
  options: CreateSharedStoreOptions<T>,
): SharedStoreHandle<T> {
  const { name, initial, persist: _persist, onError } = options;
  const resolvedInitial = resolveInitial<T>(name, initial, _persist);

  if (isBrowser) {
    const transport = createTransport(name);
    const store = new InternalStore<T>(resolvedInitial, transport, onError);
    setInstance(name, store);
  } else {
    const store = new NoopInternalStore<T>(resolvedInitial);
    setInstance(name, store);
  }

  return new SharedStoreHandle<T>(name);
}
