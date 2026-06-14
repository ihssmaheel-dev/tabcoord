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
    expect(result).toEqual({ _t: 'patch', a: 2, c: false });
  });

  it('detects added fields', () => {
    const prev = { a: 1 };
    const next = { a: 1, b: 'new' };
    expect(diff(prev, next)).toEqual({ _t: 'patch', b: 'new' });
  });

  it('marks deleted fields as undefined', () => {
    const prev = { a: 1, b: 'x' };
    const next = { a: 1 };
    expect(diff(prev, next)).toEqual({ _t: 'patch', b: undefined });
  });
});

describe('apply', () => {
  it('applies patch to shallow object', () => {
    const obj = { a: 1, b: 'x' };
    const result = apply(obj, { _t: 'patch', a: 2, c: true });
    expect(result).toEqual({ a: 2, b: 'x', c: true });
    // Original unchanged
    expect(obj).toEqual({ a: 1, b: 'x' });
  });

  it('removes keys set to undefined', () => {
    const obj = { a: 1, b: 'x' };
    const result = apply(obj, { _t: 'patch', b: undefined });
    expect(result).toEqual({ a: 1 });
    expect('b' in result).toBe(false);
  });

  it('returns non-patch values directly', () => {
    const result = apply({ a: 1 }, { a: 2 } as any);
    expect(result).toEqual({ a: 2 });
  });
});

describe('isPatch', () => {
  it('returns true for objects with _t: patch', () => {
    expect(isPatch({ _t: 'patch' })).toBe(true);
    expect(isPatch({ _t: 'patch', a: 1 })).toBe(true);
  });

  it('returns false for non-objects', () => {
    expect(isPatch(null)).toBe(false);
    expect(isPatch(42)).toBe(false);
    expect(isPatch('str')).toBe(false);
    expect(isPatch(undefined)).toBe(false);
  });
});
