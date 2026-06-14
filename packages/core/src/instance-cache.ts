import type { InternalStoreInterface } from './internal-store-interface.js';

const _instanceCache = new Map<string, InternalStoreInterface>();

export function getInstance<T = unknown>(name: string): InternalStoreInterface<T> | undefined {
  return _instanceCache.get(name) as InternalStoreInterface<T> | undefined;
}

export function setInstance<T>(name: string, instance: InternalStoreInterface<T>): void {
  _instanceCache.set(name, instance as InternalStoreInterface);
}

export function deleteInstance(name: string): void {
  _instanceCache.delete(name);
}

export function hasInstance(name: string): boolean {
  return _instanceCache.has(name);
}
