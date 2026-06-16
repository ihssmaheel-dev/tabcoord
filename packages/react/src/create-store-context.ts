import { createContext, useContext, useEffect, type ReactNode, createElement } from 'react';
import { createSharedStore, type SharedStoreHandle, type CreateSharedStoreOptions } from 'tabcoord';

export function createStoreContext<T>(options: CreateSharedStoreOptions<T>) {
  const store = createSharedStore(options);

  const Ctx = createContext<SharedStoreHandle<T>>(store);

  function Provider({ children }: { children: ReactNode }) {
    useEffect(() => {
      return () => { store.destroy(); };
    }, []);

    return createElement(Ctx.Provider, { value: store }, children);
  }

  function useStore(): SharedStoreHandle<T> {
    return useContext(Ctx);
  }

  return { Provider, useStore, store };
}
