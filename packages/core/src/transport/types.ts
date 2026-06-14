export type MessageHandler = (data: unknown) => void;

export interface Transport {
  onMessage(handler: MessageHandler): () => void;
  send(data: unknown): void;
  destroy(): void;
  isAvailable(): boolean;
}
