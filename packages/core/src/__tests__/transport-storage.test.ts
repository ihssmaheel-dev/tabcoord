import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('storage-events transport', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
    const listeners = new Map<string, Set<EventListener>>();
    vi.stubGlobal('window', {
      addEventListener: (type: string, handler: EventListener) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(handler);
      },
      removeEventListener: (type: string, handler: EventListener) => {
        listeners.get(type)?.delete(handler);
      },
    });
    // Store listeners for test access
    (globalThis as any).__storageListeners = listeners;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as any).__storageListeners;
  });

  it('isAvailable returns true when localStorage works', async () => {
    const { createStorageEventTransport } = await import('../transport/storage-events.js');
    const t = createStorageEventTransport('test');
    expect(t.isAvailable()).toBe(true);
    t.destroy();
  });

  it('sends data by writing to localStorage', async () => {
    const { createStorageEventTransport } = await import('../transport/storage-events.js');
    const t = createStorageEventTransport('test');
    t.send({ a: 1 });
    const key = Array.from(store.keys()).find(k => k.includes('test'))!;
    expect(key).toBeTruthy();
    const parsed = JSON.parse(store.get(key)!);
    expect(parsed).toMatchObject({ a: 1 });
    t.destroy();
  });

  it('receives messages via StorageEvent', async () => {
    const handler = vi.fn();
    const { createStorageEventTransport } = await import('../transport/storage-events.js');
    const t = createStorageEventTransport('test');
    t.onMessage(handler);

    const listeners = (globalThis as any).__storageListeners as Map<string, Set<EventListener>>;
    const storageHandlers = listeners.get('storage');
    expect(storageHandlers).toBeDefined();

    // Simulate storage event from another tab
    const key = 'tabcoord:chan:test';
    store.set(key, JSON.stringify({ _meta: { source: 'other-tab' }, data: 42 }));
    const event = { key, newValue: store.get(key) };
    storageHandlers!.forEach(h => h(event as unknown as Event));

    expect(handler).toHaveBeenCalled();
    t.destroy();
  });

  it('filters own messages by tabId', async () => {
    const handler = vi.fn();
    const { createStorageEventTransport } = await import('../transport/storage-events.js');
    const t = createStorageEventTransport('test');
    t.onMessage(handler);

    const listeners = (globalThis as any).__storageListeners as Map<string, Set<EventListener>>;
    const storageHandlers = listeners.get('storage');

    const key = 'tabcoord:chan:test';
    store.set(key, JSON.stringify({ _meta: { source: 'test-uuid' }, data: 42 }));
    const event = { key, newValue: store.get(key) };
    storageHandlers!.forEach(h => h(event as unknown as Event));

    expect(handler).not.toHaveBeenCalled();
    t.destroy();
  });
});
