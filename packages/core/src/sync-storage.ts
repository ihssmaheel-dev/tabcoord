const PREFIX = 'tabcoord:v1:';
const CHANGE_CHANNEL = 'tabcoord:sync-storage';

type StorageChangeEvent = {
  key: string;
  value: string | null;
};

type MemoryStore = Map<string, string>;

let memoryFallback: MemoryStore | null = null;

function getStorage(): { set(k: string, v: string): void; get(k: string): string | null; remove(k: string): void } {
  if (typeof localStorage === 'undefined') {
    if (!memoryFallback) memoryFallback = new Map();
    return {
      set: (k, v) => memoryFallback!.set(k, v),
      get: (k) => memoryFallback!.get(k) ?? null,
      remove: (k) => memoryFallback!.delete(k),
    };
  }
  try {
    localStorage.setItem('__tabcoord_probe__', '1');
    localStorage.removeItem('__tabcoord_probe__');
    return {
      set: (k, v) => localStorage.setItem(k, v),
      get: (k) => localStorage.getItem(k),
      remove: (k) => localStorage.removeItem(k),
    };
  } catch {
    if (!memoryFallback) memoryFallback = new Map();
    return {
      set: (k, v) => memoryFallback!.set(k, v),
      get: (k) => memoryFallback!.get(k) ?? null,
      remove: (k) => memoryFallback!.delete(k),
    };
  }
}

function prefixed(key: string): string {
  return `${PREFIX}${key}`;
}

const ttlTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleTTL(key: string, ttl: number): void {
  const existing = ttlTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    removeItem(key);
    ttlTimers.delete(key);
  }, ttl);
  ttlTimers.set(key, timer);
}

let _changeChannel: BroadcastChannel | null = null;

function getChangeChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!_changeChannel) {
    try {
      _changeChannel = new BroadcastChannel(CHANGE_CHANNEL);
    } catch {
      return null;
    }
  }
  return _changeChannel;
}

function broadcast(key: string, value: string | null): void {
  const bc = getChangeChannel();
  if (!bc) return;
  try {
    bc.postMessage({ key, value } as StorageChangeEvent);
  } catch {
    // BroadcastChannel not available — rely on storage events
  }
}

export async function setItem(
  key: string,
  value: string,
  options?: { ttl?: number },
): Promise<void> {
  const storage = getStorage();
  const fullKey = prefixed(key);

  try {
    storage.set(fullKey, value);
  } catch (err) {
    if (err instanceof Error && (err.name === 'QuotaExceededError' || err.name === 'SecurityError')) {
      memoryFallback ??= new Map();
      memoryFallback.set(fullKey, value);
    } else {
      throw err;
    }
  }

  if (options?.ttl) {
    scheduleTTL(fullKey, options.ttl);
  }

  broadcast(fullKey, value);
}

export async function getItem(key: string): Promise<string | null> {
  const storage = getStorage();
  const fullKey = prefixed(key);

  try {
    return storage.get(fullKey);
  } catch {
    return null;
  }
}

export async function removeItem(key: string): Promise<void> {
  const storage = getStorage();
  const fullKey = prefixed(key);

  try {
    storage.remove(fullKey);
  } catch {
    // ignore
  }

  const timer = ttlTimers.get(fullKey);
  if (timer) {
    clearTimeout(timer);
    ttlTimers.delete(fullKey);
  }

  broadcast(fullKey, null);
}
