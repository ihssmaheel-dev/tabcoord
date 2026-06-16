import type { PersistConfig } from './persist.js';
import { rehydrateState } from './persist.js';

const _factoryCache = new Map<string, unknown>();
const MAX_FACTORY_CACHE = 100;

function cacheSet(key: string, value: unknown): void {
  if (_factoryCache.size >= MAX_FACTORY_CACHE && !_factoryCache.has(key)) {
    // Evict oldest entry (first key in insertion order)
    const first = _factoryCache.keys().next().value;
    if (first !== undefined) _factoryCache.delete(first);
  }
  _factoryCache.set(key, value);
}

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
      cacheSet(name, result);
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
    cacheSet(name, result);
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
