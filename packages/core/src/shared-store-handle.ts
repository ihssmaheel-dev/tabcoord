import type { InternalStoreInterface } from './internal-store-interface.js';
import { getInstance, deleteInstance } from './instance-cache.js';
import { clearFactoryCache } from './resolve-initial.js';

export class SharedStoreHandle<T = unknown> {
  private _fallback: T | undefined;

  constructor(private name: string, fallback?: T) {
    this._fallback = fallback;
  }

  /**
   * Returns the current state. During SSR bootstrap or before the store
   * is initialized, returns `undefined`. After `destroy()`, returns the
   * last known state.
   *
   * @remarks
   * If `get()` returns `undefined`, callers should handle it explicitly
   * to avoid runtime errors. The `status` property can be checked to
   * determine if the store is ready.
   */
  get(): T | undefined {
    const inst = getInstance(this.name) as InternalStoreInterface<T> | undefined;
    if (inst) return inst.get();
    if (this._fallback !== undefined) return this._fallback;
    console.warn(`[tabcoord] Store "${this.name}" not initialized yet`);
    return undefined;
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
