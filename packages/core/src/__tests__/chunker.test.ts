import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chunk, createChunkAssembler } from '../chunker.js';

describe('chunker', () => {
  it('returns single chunk for small payloads', () => {
    const data = { hello: 'world' };
    const result = chunk(data);
    expect(result).toHaveLength(1);
    expect(result[0]._meta.totalChunks).toBe(1);
    expect(result[0]._meta.id).toBe('');
  });

  it('splits large payloads into multiple chunks', () => {
    const large = 'x'.repeat(70 * 1024);
    const result = chunk({ data: large }, undefined, 64 * 1024);
    expect(result.length).toBeGreaterThan(1);
    expect(result[0]._meta.id).toBeTruthy();
    expect(result[0]._meta.totalChunks).toBe(result.length);
  });
});

describe('createChunkAssembler', () => {
  it('accepts single chunk immediately', () => {
    const assembler = createChunkAssembler();
    const result = assembler.accept({
      _meta: { id: '', chunkIndex: 0, totalChunks: 1 },
      payload: '{"hello":"world"}',
    });
    expect(result.done).toBe(true);
    expect(result.data).toBe('{"hello":"world"}');
    assembler.destroy();
  });

  it('reassembles multi-chunk payloads', () => {
    const assembler = createChunkAssembler();
    const data = '{"large":"' + 'a'.repeat(1000) + '"}';
    const chunks = chunk(JSON.parse(data), undefined, 500);
    expect(chunks.length).toBeGreaterThan(1);

    for (const c of chunks) {
      const r = assembler.accept(c);
      if (c._meta.chunkIndex < chunks.length - 1) {
        expect(r.done).toBe(false);
      } else {
        expect(r.done).toBe(true);
        expect(JSON.parse(r.data!)).toEqual(JSON.parse(data));
      }
    }
    assembler.destroy();
  });

  it('calls onTimeout when reassembly times out', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const assembler = createChunkAssembler({ onTimeout });

    // Send 2 of 3 chunks — missing the last one
    assembler.accept({ _meta: { id: 'race-test', chunkIndex: 0, totalChunks: 3 }, payload: 'aaa' });
    assembler.accept({ _meta: { id: 'race-test', chunkIndex: 1, totalChunks: 3 }, payload: 'bbb' });

    // Advance past 2s timeout
    vi.advanceTimersByTime(2000);

    expect(onTimeout).toHaveBeenCalledWith('race-test', 2, 3);

    // Subsequent chunks for same id should be dropped
    const result = assembler.accept({ _meta: { id: 'race-test', chunkIndex: 2, totalChunks: 3 }, payload: 'ccc' });
    expect(result.done).toBe(false);

    assembler.destroy();
    vi.useRealTimers();
  });

  it('discards partial data after timeout', async () => {
    vi.useFakeTimers();
    const assembler = createChunkAssembler();

    assembler.accept({ _meta: { id: 'timeout-data', chunkIndex: 0, totalChunks: 2 }, payload: 'part1' });

    vi.advanceTimersByTime(2000);

    // Timeout fired — entry cleared
    const result = assembler.accept({ _meta: { id: 'timeout-data', chunkIndex: 1, totalChunks: 2 }, payload: 'part2' });
    expect(result.done).toBe(false);

    assembler.destroy();
    vi.useRealTimers();
  });
});
