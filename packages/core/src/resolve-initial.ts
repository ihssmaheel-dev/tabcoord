import type { PersistConfig } from './persist.js';
import { rehydrateState } from './persist.js';

const _factoryCache = new Map<string, WeakRef<object>>();
const _registry = new FinalizationRegistry<string>((name) => {
  _factoryCache.delete(name);
});

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
      setFactoryCache(name, result);
      return result;
    }
  }

  // 2. HMR cache — module reloaded in dev, factory already ran once
  const cachedRef = _factoryCache.get(name);
  if (cachedRef) {
    const cached = cachedRef.deref();
    if (cached !== undefined) return cached as T;
    _factoryCache.delete(name);
  }

  // 3. True cold start
  const result = typeof initial === 'function' ? (initial as () => T)() : initial;
  setFactoryCache(name, result);
  return result;
}

function setFactoryCache(name: string, value: unknown): void {
  if (typeof value === 'object' && value !== null) {
    _factoryCache.set(name, new WeakRef(value));
    _registry.register(value, name);
  } else {
    // Primitives can't be WeakRef'd; store directly but won't be GC'd
    // (primitives are small, so this is acceptable)
    _factoryCache.set(name, new WeakRef({ v: value }));
  }
}

export function clearFactoryCache(name?: string): void {
  if (name) {
    _factoryCache.delete(name);
  } else {
    _factoryCache.clear();
  }
}

export type { PersistConfig };
