export interface PersistConfig<T = unknown> {
  version: number;
  prefix?: string;
  onRehydrate?: (stored: unknown, clock: string) => T;
}

export interface PersistedState<T = unknown> {
  version: number;
  clock: string;
  state: T;
}

const DEFAULT_PREFIX = 'tabcoord';

function makeKey(name: string, prefix: string): string {
  return `${prefix}:v1:${name}:state`;
}

export function persistState<T>(
  name: string,
  state: T,
  clock: string,
  prefix: string = DEFAULT_PREFIX,
): void {
  if (typeof localStorage === 'undefined') return;
  const key = makeKey(name, prefix);
  const data: PersistedState<T> = {
    version: 1,
    clock,
    state,
  };
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full or blocked — silently continue with in-memory only
  }
}

export function rehydrateState<T>(
  name: string,
  prefix: string = DEFAULT_PREFIX,
): { state: T; clock: string } | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const key = makeKey(name, prefix);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as PersistedState<T>;
    if (!parsed || typeof parsed.version !== 'number') {
      localStorage.removeItem(key);
      return undefined;
    }
    return { state: parsed.state, clock: parsed.clock };
  } catch {
    // Corrupted JSON — clear and fall back to initial
    try { localStorage.removeItem(key); } catch { /* noop */ }
    return undefined;
  }
}

export function clearPersistedState(
  name: string,
  prefix: string = DEFAULT_PREFIX,
): void {
  if (typeof localStorage === 'undefined') return;
  const key = makeKey(name, prefix);
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
