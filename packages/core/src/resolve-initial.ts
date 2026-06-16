import type { PersistConfig } from './persist.js';
import { rehydrateState } from './persist.js';

const _factoryCache = new Map<string, unknown>();

export function resolveInitial<T>(
  name: string,
  initial: T | (() => T),
  persistConfig?: PersistConfig<T>,
): T {
  const prefix = persistConfig?.prefix ?? 'tabcoord';

  // 1. Persisted state from a real previous session — source of truth
  if (persistConfig) {
    const stored = rehydrateState<T>(name, prefix);
    if (stored !== undefined) {
      const result = persistConfig.onRehydrate
        ? persistConfig.onRehydrate(stored.state, stored.clock)
        : stored.state;
      _factoryCache.set(name, result);
      return result;
    }
  }

  // 2. HMR cache — only for factory functions (static values get fresh copies)
  if (typeof initial === 'function' && _factoryCache.has(name)) {
    return _factoryCache.get(name) as T;
  }

  // 3. True cold start
  const result = typeof initial === 'function' ? (initial as () => T)() : initial;
  // Only cache factory results — static values should always be fresh copies
  if (typeof initial === 'function') {
    _factoryCache.set(name, result);
  }
  return result;
}

export function clearFactoryCache(name?: string): void {
  if (name) {
    _factoryCache.delete(name);
  } else {
    _factoryCache.clear();
  }
}

export type { PersistConfig };
