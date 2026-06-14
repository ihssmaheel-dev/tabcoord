# @tabcoord

**The coordination layer multi-tab apps are missing.**

Shared state, event bus, leader election, and distributed locks across browser tabs — zero dependencies, under 4KB gzipped.

```typescript
import { createSharedStore } from '@tabcoord/core';
import { useSharedStore } from '@tabcoord/react';

export const cart = createSharedStore({ name: 'cart', initial: { items: [] } });

// In any component — state syncs across all tabs automatically
const items = useSharedStore(cart, s => s.items);
```

## Install

```bash
npm i @tabcoord/core @tabcoord/react
# or
pnpm add @tabcoord/core @tabcoord/react
```

## Quick Start

```typescript
// store.ts — module scope, works in SSR
import { createSharedStore } from '@tabcoord/core';

export const counter = createSharedStore({
  name: 'counter',
  initial: { count: 0 },
});

// Any tab: counter.set({ count: 1 }) → all tabs update
```

```tsx
// Counter.tsx
import { useSharedStore } from '@tabcoord/react';
import { counter } from './store';

export function Counter() {
  const { count } = useSharedStore(counter, s => s);
  return (
    <button onClick={() => counter.set(s => ({ count: s.count + 1 }))}>
      {count}
    </button>
  );
}
```

## API

### `createSharedStore(options)`

Creates a cross-tab synchronized store. Returns a `SharedStoreHandle`.

```typescript
const store = createSharedStore({
  name: 'my-store',           // unique name (required)
  initial: { count: 0 },     // T | (() => T)
  persist: { version: 1 },   // optional persistence config
  onError: (err) => {},       // optional error handler
});
```

### `SharedStoreHandle`

| Method | Description |
|--------|-------------|
| `get()` | Returns current state |
| `set(value \| fn)` | Updates state (syncs to all tabs) |
| `subscribe(fn)` | Subscribe to state changes, returns unsubscribe |
| `destroy()` | Cleanup (closes channel, clears caches) |
| `status` | `'bootstrap'` or `'synced'` |

### `useSharedStore(store, selector)`

React hook for cross-tab state. Uses `useSyncExternalStore` for concurrent mode safety.

```typescript
const count = useSharedStore(store, s => s.count);
```

### `useSharedEvent(bus, event, handler)`

React hook for cross-tab events.

### `eventBus(name)`

Cross-tab event bus with wildcard matching and replay.

```typescript
const bus = eventBus('app-events');
bus.on('user:*', (event) => console.log(event));
bus.emit('user:login', { userId: 123 });
bus.destroy();
```

### `createStoreContext(options)`

Creates a React Context bound to a store. Returns `{ Provider, useStore, store }`.

## SSR

TabSync works in SSR environments (Next.js, Remix, etc.). On the server, `createSharedStore` returns a no-op store that returns the initial value. On the client, it transparently swaps to a real synchronized store.

```typescript
// This works in module scope — no hydration mismatch
export const cart = createSharedStore({
  name: 'cart',
  initial: { items: [] },
});
```

The `SharedStoreHandle` identity never changes, so module-scope exports stay valid across SSR → hydration.

See [docs/ssr.md](docs/ssr.md) for details.

## Persistence

```typescript
const cart = createSharedStore({
  name: 'cart',
  initial: { items: [] },
  persist: {
    version: 1,                    // bump to invalidate old data
    prefix: 'myapp',               // optional, default 'tabcoord'
    onRehydrate: (state, clock) => state,  // optional transform
  },
});
```

State is persisted to `localStorage` on every `set()`. On page reload, the stored state is used as the initial value. Corrupted JSON is silently cleared and falls back to the `initial` value.

## Destroy

Call `destroy()` when the store is no longer needed (e.g., SPA route change):

```typescript
cart.destroy();
// set() and get() become no-ops with a dev warning
// Re-creating with the same name starts fresh
```

## Reserved Keys

The keys `_meta` and `$tabcoord` are reserved by the framework. If your state contains these keys, they are silently stripped before storage.

## Browser Support

- Chrome 54+
- Firefox 38+
- Safari 16+ (private browsing falls back to in-memory)

Falls back through: `BroadcastChannel` → `localStorage` + `storage` event → in-memory noop.

## License

MIT
