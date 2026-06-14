import type { InternalStoreInterface } from './internal-store-interface.js';
import { getInstance, deleteInstance } from './instance-cache.js';
import { clearFactoryCache } from './resolve-initial.js';

export class SharedStoreHandle<T = unknown> {
  constructor(private name: string) {}

  get(): T {
    return (getInstance(this.name) as InternalStoreInterface<T>)?.get() as T;
  }

  set(value: T | ((prev: T) => T)): void {
    const inst = getInstance(this.name) as InternalStoreInterface<T> | undefined;
    inst?.set(value);
  }

  subscribe(fn: (state: T) => void): () => void {
    const inst = getInstance(this.name) as InternalStoreInterface<T> | undefined;
    return inst?.subscribe(fn) ?? (() => {});
  }

  destroy(): void {
    const inst = getInstance(this.name);
    if (inst) {
      inst.destroy();
      deleteInstance(this.name);
    }
    clearFactoryCache(this.name);
  }

  get status(): 'bootstrap' | 'synced' {
    const inst = getInstance(this.name);
    return inst?.status ?? 'synced';
  }
}
