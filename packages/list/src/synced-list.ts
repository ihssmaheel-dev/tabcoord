import { createSharedStore } from '@tabcoord/core';

export interface TaggedItem<T> {
  _tag: string;
  value: T;
}

export interface SyncedListState<T> {
  items: TaggedItem<T>[];
}

export interface SyncedList<T> {
  add(item: T): void;
  remove(predicate: (item: T) => boolean): void;
  update(predicate: (item: T) => boolean, updater: (item: T) => T): void;
  toArray(): T[];
  get length(): number;
  subscribe(fn: (items: T[]) => void): () => void;
  destroy(): void;
}

function generateTag(): string {
  return `${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

export function syncedList<T>(
  name: string,
  initial: T[] = [],
): SyncedList<T> {
  const store = createSharedStore<SyncedListState<T>>({
    name,
    initial: { items: initial.map((value) => ({ _tag: generateTag(), value })) },
  });

  function getItems(): TaggedItem<T>[] {
    return store.get().items;
  }

  return {
    add(item: T): void {
      store.set((prev) => ({
        items: [...prev.items, { _tag: generateTag(), value: item }],
      }));
    },

    remove(predicate: (item: T) => boolean): void {
      store.set((prev) => ({
        items: prev.items.filter((tagged) => !predicate(tagged.value)),
      }));
    },

    update(predicate: (item: T) => boolean, updater: (item: T) => T): void {
      store.set((prev) => ({
        items: prev.items.map((tagged) =>
          predicate(tagged.value)
            ? { ...tagged, value: updater(tagged.value) }
            : tagged,
        ),
      }));
    },

    toArray(): T[] {
      return getItems().map((tagged) => tagged.value);
    },

    get length(): number {
      return getItems().length;
    },

    subscribe(fn: (items: T[]) => void): () => void {
      return store.subscribe((state) => {
        fn(state.items.map((tagged) => tagged.value));
      });
    },

    destroy(): void {
      store.destroy();
    },
  };
}
