import type { Transport, MessageHandler } from './types.js';
import { getTabId } from '../tab-id.js';

export function createBroadcastChannelTransport(name: string): Transport {
  const channel = new BroadcastChannel(name);
  const tabId = getTabId();
  const handlers = new Set<MessageHandler>();

  channel.onmessage = (event: MessageEvent) => {
    const msg = event.data as Record<string, unknown>;
    const meta = msg?._meta as Record<string, unknown> | undefined;
    if (meta?.source === tabId) return;
    for (const h of handlers) {
      try { h(msg); } catch { /* one handler throw should not block others */ }
    }
  };

  return {
    onMessage(handler: MessageHandler): () => void {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    send(data: unknown): void {
      channel.postMessage(data);
    },
    destroy(): void {
      channel.close();
      handlers.clear();
    },
    isAvailable(): boolean {
      return typeof BroadcastChannel !== 'undefined';
    },
  };
}
