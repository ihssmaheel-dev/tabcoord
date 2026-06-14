import type { Transport, MessageHandler } from './types.js';

export function createNoopTransport(): Transport {
  return {
    onMessage(_handler: MessageHandler): () => void {
      return () => {};
    },
    send(_data: unknown): void {
      // no-op
    },
    destroy(): void {
      // no-op
    },
    isAvailable(): boolean {
      return true;
    },
  };
}
