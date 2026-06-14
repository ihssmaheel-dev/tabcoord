import { describe, it, expect } from 'vitest';

describe('clock', () => {
  it('tick returns incremented counter', async () => {
    const { tick, serialize } = await import('../clock.js');
    const a = tick();
    const b = tick();
    const sa = serialize(a);
    const sb = serialize(b);
    expect(sa.split(':')[0]).toBe('1');
    expect(sb.split(':')[0]).toBe('2');
  });

  it('compare returns -1/0/1', async () => {
    const { tick, compare } = await import('../clock.js');
    const a = tick();
    const b = tick();
    const c = tick();
    expect(compare(a, a)).toBe(0);
    expect(compare(a, b)).toBe(-1);
    expect(compare(c, b)).toBe(1);
  });

  it('serialize and deserialize are inverses', async () => {
    const { tick, serialize, deserialize } = await import('../clock.js');
    const c = tick();
    expect(deserialize(serialize(c))).toEqual(c);
  });

  it('deserialize handles strings without colon', async () => {
    const { deserialize } = await import('../clock.js');
    // indexOf returns -1, returns fallback clock
    const empty = deserialize('');
    expect(empty.counter).toBe(0);
    expect(empty.tabId).toBe('unknown');

    const noColon = deserialize('abc');
    expect(noColon.counter).toBe(0);
    expect(noColon.tabId).toBe('abc');
  });

  it('compare uses tabId as tiebreaker', async () => {
    const { compare, deserialize } = await import('../clock.js');
    const a = deserialize('5:aaaa');
    const b = deserialize('5:bbbb');
    expect(compare(a, b)).toBe(-1);
    expect(compare(b, a)).toBe(1);
  });
});
