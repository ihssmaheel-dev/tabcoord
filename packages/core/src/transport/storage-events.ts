import type { Transport, MessageHandler } from './types.js';
import { getTabId } from '../tab-id.js';

const STORAGE_PREFIX = 'tabcoord:chan:';
const seen = new Set<string>();
const MAX_SEEN = 500;

export function createStorageEventTransport(name: string): Transport {
  const tabId = getTabId();
  const key = STORAGE_PREFIX + name;
  const handlers = new Set<MessageHandler>();

  function handleStorage(e: StorageEvent): void {
    if (e.key !== key || !e.newValue) return;
    try {
      const pipeIdx = e.newValue.lastIndexOf('|');
      const jsonStr = pipeIdx !== -1 ? e.newValue.substring(0, pipeIdx) : e.newValue;
      const msg = JSON.parse(jsonStr) as Record<string, unknown>;
      const meta = msg?._meta as Record<string, unknown> | undefined;
      if (meta?.source === tabId) return;
      const msgId = meta?.id as string | undefined;
      if (msgId) {
        if (seen.has(msgId)) return;
        seen.add(msgId);
        if (seen.size > MAX_SEEN) {
          const first = seen.values().next().value;
          if (first !== undefined) seen.delete(first);
        }
      }
      for (const h of handlers) h(msg);
    } catch {
      // ignore malformed messages
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  return {
    onMessage(handler: MessageHandler): () => void {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    send(data: unknown): void {
      try {
        const json = JSON.stringify(data);
        // Workaround: same-value writes don't fire StorageEvent per HTML spec.
        // Append a timestamp to ensure the value always changes.
        localStorage.setItem(key, json + '|' + Date.now());
      } catch {
        // caller handles storage errors via onError
      }
    },
    destroy(): void {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
      }
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
