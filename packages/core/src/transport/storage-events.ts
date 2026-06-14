import type { Transport, MessageHandler } from './types.js';
import { getTabId } from '../tab-id.js';

const STORAGE_PREFIX = 'tabcoord:chan:';

export function createStorageEventTransport(name: string): Transport {
  const tabId = getTabId();
  const key = STORAGE_PREFIX + name;
  const handlers = new Set<MessageHandler>();

  function handleStorage(e: StorageEvent): void {
    if (e.key !== key || !e.newValue) return;
    try {
      const msg = JSON.parse(e.newValue) as Record<string, unknown>;
      const meta = msg?._meta as Record<string, unknown> | undefined;
      if (meta?.source === tabId) return;
      for (const h of handlers) h(msg);
    } catch {
      // ignore malformed messages
    }
  }

  window.addEventListener('storage', handleStorage);

  return {
    onMessage(handler: MessageHandler): () => void {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    send(data: unknown): void {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        // caller handles storage errors via onError
      }
    },
    destroy(): void {
      window.removeEventListener('storage', handleStorage);
      handlers.clear();
      try {
        localStorage.removeItem(key);
      } catch { /* noop */ }
    },
    isAvailable(): boolean {
      try {
        localStorage.setItem('__tabcoord_test__', '1');
        localStorage.removeItem('__tabcoord_test__');
        return true;
      } catch {
        return false;
      }
    },
  };
}
