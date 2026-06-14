export interface PersistConfig<T = unknown> {
  version: number;
  prefix?: string;
  onRehydrate?: (stored: unknown, clock: string) => T;
}

const _factoryCache = new Map<string, unknown>();

export function resolveInitial<T>(
  name: string,
  initial: T | (() => T),
  _persistConfig?: PersistConfig<T>,
): T {
  // 1. Persisted state — checked at call site before calling this
  // 2. HMR cache — module reloaded in dev, factory already ran once
  if (_factoryCache.has(name)) {
    return _factoryCache.get(name) as T;
  }

  // 3. True cold start
  const result = typeof initial === 'function' ? (initial as () => T)() : initial;
  _factoryCache.set(name, result);
  return result;
}

export function clearFactoryCache(name?: string): void {
  if (name) {
    _factoryCache.delete(name);
  } else {
    _factoryCache.clear();
  }
}
