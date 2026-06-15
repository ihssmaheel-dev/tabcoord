# @tabcoord

**Sync state across browser tabs. One line of code.**

```typescript
import { createSharedStore } from '@tabcoord/core';

const cart = createSharedStore({ name: 'cart', initial: { items: [] } });
// Now any tab can read/write cart, and they all stay in sync.
```

## What is this?

TabCoord lets you share state between browser tabs. Open your app in two tabs — change something in one tab, and it appears in the other instantly. No server needed. No WebSocket. Just browser tabs talking to each other.

## Quick Start

```bash
npm install @tabcoord/core @tabcoord/react
```

**Step 1: Create a shared store**

```typescript
// store.ts
import { createSharedStore } from '@tabcoord/core';

export const cart = createSharedStore({
  name: 'cart',
  initial: { items: [] },
});
```

**Step 2: Use it in your app**

```tsx
// Cart.tsx
import { useSharedStore } from '@tabcoord/react';
import { cart } from './store';

export function Cart() {
  const items = useSharedStore(cart, s => s.items);

  return (
    <button onClick={() => cart.set(s => ({
      items: [...s.items, 'Widget']
    }))}>
      Add Widget ({items.length})
    </button>
  );
}
```

**Step 3: Open two tabs.** Add an item in Tab A. It appears in Tab B automatically.

## Features

| Feature | What it does |
|---------|-------------|
| **Shared State** | Read/write state across tabs — changes sync instantly |
| **Leader Election** | One tab becomes the "leader" — useful for background tasks |
| **Lock Manager** | Prevent two tabs from doing the same thing at once |
| **Event Bus** | Send events between tabs with wildcard matching |
| **Persistence** | State survives page reload (localStorage) |
| **SSR Support** | Works in Next.js, Remix, etc. |

## Why use this?

**Without TabCoord:**
```typescript
// You need a server, WebSocket, or complex localStorage logic
// to keep two tabs in sync. Good luck.
```

**With TabCoord:**
```typescript
const store = createSharedStore({ name: 'counter', initial: { count: 0 } });
// Two tabs. Instant sync. No server. Done.
```

## How it works

1. **Same origin only** — tabs must be on the same website (e.g., `localhost:3000`)
2. **BroadcastChannel** — uses the browser's built-in tab messaging (with fallback to localStorage)
3. **Logical clock** — each write gets a timestamp so tabs agree on which version is newest
4. **Bootstrap handshake** — when a new tab opens, it asks existing tabs for the current state

## API

### `createSharedStore(options)`

Creates a store that syncs across tabs.

```typescript
const store = createSharedStore({
  name: 'my-store',          // unique name
  initial: { count: 0 },     // starting value
  persist: { version: 1 },   // optional: save to localStorage
});
```

### `SharedStoreHandle`

| Method | Description |
|--------|-------------|
| `store.get()` | Get current state |
| `store.set(value)` | Update state (syncs to all tabs) |
| `store.set(fn)` | Update with a function: `s => ({ ...s, count: s.count + 1 })` |
| `store.subscribe(fn)` | Listen for changes |
| `store.destroy()` | Clean up when done |

### `useSharedStore(store, selector)`

React hook for reading state:

```tsx
const count = useSharedStore(store, s => s.count);
```

### `eventBus(name)`

Send events between tabs:

```typescript
const bus = eventBus('my-events');
bus.emit('user:login', { userId: 123 });
bus.on('user:*', (event) => console.log(event));
```

### `leaderElection(name)`

Elect a leader tab (one tab is "the boss"):

```typescript
const election = leaderElection('my-leader');
election.onElected(() => {
  console.log('This tab is the leader!');
  // Start background work here
});
```

### `lockManager(name)`

Lock to prevent two tabs from doing the same thing:

```typescript
const lock = lockManager('my-lock');
await lock.acquire(async () => {
  // Only one tab runs this at a time
  await doExpensiveWork();
});
```

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome 54+ | ✅ Full |
| Firefox 38+ | ✅ Full |
| Safari 16+ | ✅ Full |
| Edge 79+ | ✅ Full |
| Node.js | ⚠️ SSR only (no cross-tab sync) |

## Bundle Size

- **@tabcoord/core**: 4.78 KB gzipped, zero dependencies
- **@tabcoord/react**: 0.9 KB gzipped

## Demos

Run any demo to see it in action:

```bash
pnpm --filter @tabcoord/demo-shared-cart dev    # Shopping cart
pnpm --filter @tabcoord/demo-auth-sync dev      # Auth sync
pnpm --filter @tabcoord/demo-background-sync dev # Leader election
pnpm --filter @tabcoord/demo-distributed-form dev # Field merge
```

## When NOT to use this

- **Single tab only** — no benefit
- **Multiple users** — this is for one person's tabs, not collaboration
- **Cross-device** — same browser only
- **Large state (>5MB)** — localStorage has limits

## License

MIT — see [LICENSE](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
