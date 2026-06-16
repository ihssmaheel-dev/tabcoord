import { createContext, useContext, useEffect, useState, type ReactNode, createElement } from 'react';
import { createSharedStore, type SharedStoreHandle, type CreateSharedStoreOptions } from 'tabcoord';

export function createStoreContext<T>(options: CreateSharedStoreOptions<T>) {
  const Ctx = createContext<SharedStoreHandle<T> | null>(null);

  let storeInstance: SharedStoreHandle<T> | null = null;

  function getOrCreateStore(): SharedStoreHandle<T> {
    if (!storeInstance) {
      storeInstance = createSharedStore<T>(options);
    }
    return storeInstance;
  }

  function Provider({ children }: { children: ReactNode }) {
    const [store] = useState(() => getOrCreateStore());

    useEffect(() => {
      return () => {
        store.destroy();
        storeInstance = null;
      };
    }, [store]);

    return createElement(Ctx.Provider, { value: store }, children);
  }

  function useStore(): SharedStoreHandle<T> {
    const store = useContext(Ctx);
    if (!store) {
      throw new Error('useStore must be used within a Provider. Wrap your component with the Provider from createStoreContext.');
    }
    return store;
  }

  return { Provider, useStore, get store() { return getOrCreateStore(); } };
}
