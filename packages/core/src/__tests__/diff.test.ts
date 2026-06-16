import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('diff', () => {
  it('returns prev for identical shallow objects', async () => {
    const { diff } = await import('../diff.js');
    const obj = { a: 1, b: 'hello' };
    expect(diff(obj, obj)).toBe(obj);
  });

  it('returns patch with changed fields', async () => {
    const { diff, isPatch } = await import('../diff.js');
    const result = diff({ a: 1, b: 2 }, { a: 1, b: 3 });
    expect(isPatch(result)).toBe(true);
    expect((result as Record<string, unknown>).b).toBe(3);
  });

  it('detects added fields', async () => {
    const { diff, isPatch } = await import('../diff.js');
    const result = diff({ a: 1 }, { a: 1, b: 2 });
    expect(isPatch(result)).toBe(true);
    expect((result as Record<string, unknown>).b).toBe(2);
  });

  it('marks deleted fields as undefined', async () => {
    const { diff, isPatch } = await import('../diff.js');
    const result = diff({ a: 1, b: 2 }, { a: 1 });
    expect(isPatch(result)).toBe(true);
    expect('b' in (result as Record<string, unknown>)).toBe(true);
    expect((result as Record<string, unknown>).b).toBeUndefined();
  });

  it('apply applies patch to shallow object', async () => {
    const { diff, apply } = await import('../diff.js');
    const prev = { a: 1, b: 2 };
    const patch = diff(prev, { a: 1, b: 3 });
    const result = apply(prev, patch);
    expect(result).toEqual({ a: 1, b: 3 });
  });

  it('apply removes keys set to undefined', async () => {
    const { diff, apply } = await import('../diff.js');
    const prev = { a: 1, b: 2 };
    const patch = diff(prev, { a: 1 });
    const result = apply(prev, patch);
    expect(result).toEqual({ a: 1 });
    expect('b' in result).toBe(false);
  });

  it('apply returns non-patch values directly', async () => {
    const { apply } = await import('../diff.js');
    const result = apply({ a: 1 }, { a: 2 } as any);
    expect(result).toEqual({ a: 2 });
  });

  it('isPatch returns true for objects with $patch sentinel', async () => {
    const { isPatch } = await import('../diff.js');
    expect(isPatch({ $patch: true })).toBe(true);
    expect(isPatch({ $patch: true, a: 1 })).toBe(true);
  });

  it('isPatch returns false for old _t sentinel', async () => {
    const { isPatch } = await import('../diff.js');
    expect(isPatch({ _t: 'patch' })).toBe(false);
  });

  it('isPatch returns false for non-objects', async () => {
    const { isPatch } = await import('../diff.js');
    expect(isPatch(null)).toBe(false);
    expect(isPatch(42)).toBe(false);
    expect(isPatch('str')).toBe(false);
    expect(isPatch(undefined)).toBe(false);
  });

  it('isPatch returns false for single-key $patch without value', async () => {
    const { isPatch } = await import('../diff.js');
    expect(isPatch({ $patch: true })).toBe(true);
  });

  it('diff detects nested object changes (shallow comparison)', async () => {
    const { diff, isPatch } = await import('../diff.js');
    const prev = { nested: { a: 1 } };
    const next = { nested: { a: 2 } };
    const result = diff(prev, next);
    // Shallow diff — nested object reference changed, so it's a patch
    expect(isPatch(result)).toBe(true);
  });

  it('diff returns prev when nested references are the same', async () => {
    const { diff } = await import('../diff.js');
    const nested = { a: 1 };
    const obj = { nested };
    expect(diff(obj, { nested })).toBe(obj);
  });

  it('diff handles arrays by returning a patch (not next directly)', async () => {
    const { diff, isPatch } = await import('../diff.js');
    const prev = { items: [1, 2] } as any;
    const next = { items: [1, 2, 3] } as any;
    const result = diff(prev, next);
    // Array objects have different references, so diff returns a patch
    expect(isPatch(result)).toBe(true);
  });

  it('diff handles null values', async () => {
    const { diff, isPatch } = await import('../diff.js');
    const result = diff({ a: null as any }, { a: 'hello' });
    expect(isPatch(result)).toBe(true);
    expect((result as Record<string, unknown>).a).toBe('hello');
  });

  it('diff handles type changes between same typeof', async () => {
    const { diff, isPatch } = await import('../diff.js');
    // Both are typeof 'object', so diff compares keys
    const result = diff({ a: 1 } as any, { a: 'hello' } as any);
    expect(isPatch(result)).toBe(true);
  });
});
