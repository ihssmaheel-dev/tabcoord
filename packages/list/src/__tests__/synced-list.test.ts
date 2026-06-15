import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('syncedList', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    vi.stubGlobal('BroadcastChannel', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates with initial items', async () => {
    const { syncedList } = await import('../synced-list.js');
    const list = syncedList('test-init', ['a', 'b', 'c']);

    expect(list.toArray()).toEqual(['a', 'b', 'c']);
    expect(list.length).toBe(3);
    list.destroy();
  });

  it('creates empty list', async () => {
    const { syncedList } = await import('../synced-list.js');
    const list = syncedList('test-empty');

    expect(list.toArray()).toEqual([]);
    expect(list.length).toBe(0);
    list.destroy();
  });

  it('add appends item', async () => {
    const { syncedList } = await import('../synced-list.js');
    const list = syncedList('test-add');

    list.add('hello');
    expect(list.toArray()).toEqual(['hello']);
    expect(list.length).toBe(1);

    list.add('world');
    expect(list.toArray()).toEqual(['hello', 'world']);
    expect(list.length).toBe(2);

    list.destroy();
  });

  it('remove removes matching items', async () => {
    const { syncedList } = await import('../synced-list.js');
    const list = syncedList('test-remove', ['a', 'b', 'c']);

    list.remove((item) => item === 'b');
    expect(list.toArray()).toEqual(['a', 'c']);

    list.remove((item) => item === 'a');
    expect(list.toArray()).toEqual(['c']);

    list.destroy();
  });

  it('update modifies matching items', async () => {
    const { syncedList } = await import('../synced-list.js');
    const list = syncedList('test-update', [1, 2, 3]);

    list.update((item) => item === 2, (item) => item * 10);
    expect(list.toArray()).toEqual([1, 20, 3]);

    list.destroy();
  });

  it('subscribe notifies on changes', async () => {
    const { syncedList } = await import('../synced-list.js');
    const list = syncedList('test-subscribe');
    const fn = vi.fn();

    list.subscribe(fn);
    list.add('hello');

    expect(fn).toHaveBeenCalledWith(['hello']);

    list.destroy();
  });

  it('unsubscribe stops notifications', async () => {
    const { syncedList } = await import('../synced-list.js');
    const list = syncedList('test-unsub');
    const fn = vi.fn();

    const unsub = list.subscribe(fn);
    unsub();

    list.add('hello');
    expect(fn).not.toHaveBeenCalled();

    list.destroy();
  });

  it('handles complex objects', async () => {
    const { syncedList } = await import('../synced-list.js');
    interface Cursor {
      x: number;
      y: number;
      color: string;
    }

    const list = syncedList<Cursor>('test-cursors');
    list.add({ x: 10, y: 20, color: 'red' });
    list.add({ x: 30, y: 40, color: 'blue' });

    expect(list.toArray()).toEqual([
      { x: 10, y: 20, color: 'red' },
      { x: 30, y: 40, color: 'blue' },
    ]);

    list.update((item) => item.color === 'red', (item) => ({ ...item, x: 50 }));
    expect(list.toArray()[0].x).toBe(50);

    list.destroy();
  });
});
