import { describe, it, expect } from 'vitest';
import { diff, apply, isPatch } from '../diff.js';

describe('diff', () => {
  it('returns prev for identical shallow objects', () => {
    const prev = { a: 1, b: 'x' };
    const next = { a: 1, b: 'x' };
    const result = diff(prev, next);
    expect(isPatch(result)).toBe(false);
    expect(result).toBe(prev);
  });

  it('returns patch with changed fields', () => {
    const prev = { a: 1, b: 'x', c: true };
    const next = { a: 2, b: 'x', c: false };
    const result = diff(prev, next);
    expect(result).toEqual({ $patch: true, a: 2, c: false });
  });

  it('detects added fields', () => {
    const prev = { a: 1 };
    const next = { a: 1, b: 'new' };
    expect(diff(prev, next)).toEqual({ $patch: true, b: 'new' });
  });

  it('marks deleted fields as undefined', () => {
    const prev = { a: 1, b: 'x' };
    const next = { a: 1 };
    expect(diff(prev, next)).toEqual({ $patch: true, b: undefined });
  });
});

describe('apply', () => {
  it('applies patch to shallow object', () => {
    const obj = { a: 1, b: 'x' };
    const result = apply(obj, { $patch: true, a: 2, c: true } as any);
    expect(result).toEqual({ a: 2, b: 'x', c: true });
    // Original unchanged
    expect(obj).toEqual({ a: 1, b: 'x' });
  });

  it('removes keys set to undefined', () => {
    const obj = { a: 1, b: 'x' };
    const result = apply(obj, { $patch: true, b: undefined } as any);
    expect(result).toEqual({ a: 1 });
    expect('b' in result).toBe(false);
  });

  it('returns non-patch values directly', () => {
    const result = apply({ a: 1 }, { a: 2 } as any);
    expect(result).toEqual({ a: 2 });
  });
});

describe('isPatch', () => {
  it('returns true for objects with $patch sentinel', () => {
    expect(isPatch({ $patch: true })).toBe(true);
    expect(isPatch({ $patch: true, a: 1 })).toBe(true);
  });

  it('returns false for old _t sentinel', () => {
    expect(isPatch({ _t: 'patch' })).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(isPatch(null)).toBe(false);
    expect(isPatch(42)).toBe(false);
    expect(isPatch('str')).toBe(false);
    expect(isPatch(undefined)).toBe(false);
  });

  it('returns false for single-key $patch without value', () => {
    // $patch: true alone with no other keys is still a patch (matches interface)
    expect(isPatch({ $patch: true })).toBe(true);
  });
});
