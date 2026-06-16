import type { Clock } from './clock.js';

const DEFAULT_THRESHOLD = 64 * 1024; // 64KB
const REASSEMBLY_TIMEOUT = 2000;

export interface ChunkMeta {
  id: string;
  chunkIndex: number;
  totalChunks: number;
}

export interface ChunkMessage {
  _meta: ChunkMeta;
  payload: string;
}

/*@__PURE__*/ export function chunk(
  data: unknown,
  _clock?: Clock,
  threshold: number = DEFAULT_THRESHOLD,
): ChunkMessage[] {
  // For small payloads, stringify only once and check length
  const json = JSON.stringify(data);
  if (json.length <= threshold) {
    return [
      {
        _meta: { id: '', chunkIndex: 0, totalChunks: 1 },
        payload: json,
      },
    ];
  }

  const totalChunks = Math.ceil(json.length / threshold);
  // generate a shared id for all chunks
  const id = `${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;

  const chunks: ChunkMessage[] = [];
  for (let i = 0; i < totalChunks; i++) {
    chunks.push({
      _meta: { id, chunkIndex: i, totalChunks },
      payload: json.slice(i * threshold, (i + 1) * threshold),
    });
  }
  return chunks;
}

export interface AcceptResult {
  done: boolean;
  data?: string;
  failed?: boolean;
}

export function createChunkAssembler(options?: {
  onTimeout?: (id: string, chunksReceived: number, totalChunks: number) => void;
}): {
  accept: (msg: ChunkMessage) => AcceptResult;
  destroy: () => void;
} {
  const buffers = new Map<
    string,
    {
      chunks: Map<number, string>;
      resolved: boolean;
      timeoutHandle: ReturnType<typeof setTimeout> | null;
    }
  >();

  function assemble(entry: {
    chunks: Map<number, string>;
  }): string {
    const ordered: string[] = [];
    for (let i = 0; i < entry.chunks.size; i++) {
      const part = entry.chunks.get(i);
      if (part) ordered.push(part);
    }
    return ordered.join('');
  }

  return {
    accept(msg: ChunkMessage): AcceptResult {
      const { id, chunkIndex, totalChunks } = msg._meta;

      if (!id) {
        // single chunk, no fragmentation needed
        return { done: true, data: msg.payload };
      }

      let entry = buffers.get(id);
      if (!entry) {
        entry = {
          chunks: new Map(),
          resolved: false,
          timeoutHandle: null,
        };
        buffers.set(id, entry);
      }

      if (entry.resolved) return { done: false };
      entry.chunks.set(chunkIndex, msg.payload);

      if (entry.chunks.size === totalChunks) {
        entry.resolved = true;
        if (entry.timeoutHandle) {
          clearTimeout(entry.timeoutHandle);
          entry.timeoutHandle = null;
        }
        const data = assemble(entry);
        buffers.delete(id);
        return { done: true, data };
      }

      if (!entry.timeoutHandle) {
        entry.timeoutHandle = setTimeout(() => {
          if (!entry!.resolved) {
            entry!.resolved = true;
            options?.onTimeout?.(id, entry!.chunks.size, totalChunks);
            buffers.delete(id);
          }
        }, REASSEMBLY_TIMEOUT);
      }

      return { done: false };
    },
    destroy(): void {
      for (const entry of buffers.values()) {
        if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
      }
      buffers.clear();
    },
  };
}
