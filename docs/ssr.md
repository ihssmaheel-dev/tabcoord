# SSR (Server-Side Rendering)

TabSync works seamlessly with SSR frameworks like Next.js, Remix, and Nuxt.

## How It Works

1. **Server:** `createSharedStore` creates a `NoopInternalStore` — returns initial value, no cross-tab sync
2. **Client:** On first access, the `SharedStoreHandle` transparently swaps to a real `InternalStore`
3. **Hydration:** The handle identity never changes, so React/Vue references stay valid

```typescript
// This works in module scope — no hydration mismatch
export const cart = createSharedStore({
  name: 'cart',
  initial: { items: [] },
});
```

## The Singleton Pattern

The `SharedStoreHandle` is a thin wrapper that delegates to an internal store via a module-level cache:

```
Server:  SharedStoreHandle → NoopInternalStore (initial value only)
Client:  SharedStoreHandle → InternalStore (real cross-tab sync)
```

Because the handle is a stable-identity wrapper class (not a Proxy), module-scope exports stay valid:

```typescript
// store.ts — safe to import anywhere
import { createSharedStore } from '@tabcoord/core';
export const cart = createSharedStore({ name: 'cart', initial: { items: [] } });

// Component.tsx — works on server and client
import { cart } from './store';
const items = cart.get(); // server: initial value, client: synced state
```

## Hydration Mismatch Prevention

The `useSharedStore` hook uses a separate server snapshot function that returns the initial value (not rehydrated from localStorage), ensuring server and client render the same thing on first paint.

```tsx
// This won't cause a hydration mismatch
const items = useSharedStore(cart, s => s.items);
// Server renders: [] (initial)
// Client renders: [] (initial, then syncs)
```

## createStoreContext

For apps that need dependency injection:

```tsx
import { createStoreContext } from '@tabcoord/react';

const { Provider, useStore } = createStoreContext({
  name: 'cart',
  initial: { items: [] },
});

// Provider wraps children — store is created at module scope
function App() {
  return (
    <Provider>
      <Cart />
    </Provider>
  );
}
```

The `Provider` component calls `store.destroy()` on unmount, cleaning up the transport and subscriptions.

## What Doesn't Work in SSR

- **Live cross-tab data at render time** — server output reflects only the resolved `initial` value
- **BroadcastChannel** — not available on the server, falls back to noop
- **localStorage** — not available on the server, falls back to noop

This is by design. The server renders a static snapshot; the client takes over with live sync.
