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

function estimateSize(data: unknown): number {
  if (data === null || data === undefined) return 4;
  if (typeof data === 'boolean') return data ? 4 : 5;
  if (typeof data === 'number') return String(data).length;
  if (typeof data === 'string') return data.length + 2; // +2 for quotes
  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      let size = 2; // []
      for (let i = 0; i < data.length; i++) {
        if (i > 0) size += 1; // comma
        size += estimateSize(data[i]);
      }
      return size;
    }
    // Object — estimate conservatively (keys + values)
    let size = 2; // {}
    let first = true;
    for (const key in data) {
      if (!first) size += 1; // comma
      first = false;
      size += key.length + 3; // "key":
      size += estimateSize((data as Record<string, unknown>)[key]);
    }
    return size;
  }
  return 16; // fallback for functions, symbols, etc.
}

/*@__PURE__*/ export function chunk(
  data: unknown,
  _clock?: Clock,
  threshold: number = DEFAULT_THRESHOLD,
): ChunkMessage[] {
  // Quick estimate before full stringify — avoids allocation for tiny payloads
  const estimated = estimateSize(data);
  if (estimated <= threshold) {
    const json = JSON.stringify(data);
    // Verify estimate was accurate
    if (json.length <= threshold) {
      return [
        {
          _meta: { id: '', chunkIndex: 0, totalChunks: 1 },
          payload: json,
        },
      ];
    }
    // Estimate was wrong — fall through to chunking
    const totalChunks = Math.ceil(json.length / threshold);
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

  // Estimate says it's large — stringify once and chunk
  const json = JSON.stringify(data);
  const totalChunks = Math.ceil(json.length / threshold);
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
