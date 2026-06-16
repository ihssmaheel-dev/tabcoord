# tabcoord

**Sync state across browser tabs. One line of code.**

[![npm version](https://img.shields.io/npm/v/tabcoord.svg)](https://www.npmjs.com/package/tabcoord)
[![license](https://img.shields.io/npm/l/tabcoord.svg)](https://www.npmjs.com/package/tabcoord)

```typescript
import { createSharedStore } from 'tabcoord';

const cart = createSharedStore({ name: 'cart', initial: { items: [] } });
// Now any tab can read/write cart, and they all stay in sync.
```

---

## Why TabCoord?

When you open the same app in two browser tabs, they don't know about each other. TabCoord fixes that. Change something in one tab, and it appears in the other instantly — no server, no WebSocket, no complex setup.

**What you get:**
- Shared state that syncs across tabs in real-time
- Leader election (one tab becomes "the boss" for background tasks)
- Lock manager (prevent two tabs from doing the same thing)
- Event bus (send messages between tabs)
- Automatic persistence (state survives page reload)
- Works with React, SSR, and any JavaScript framework

**What you don't need:**
- A backend server
- WebSocket connections
- Complex localStorage logic
- Third-party state management libraries

---

## Quick Start

### 1. Install

```bash
npm install tabcoord tabcoord-react
```

### 2. Create a shared store

```typescript
// store.ts
import { createSharedStore } from 'tabcoord';

export const cart = createSharedStore({
  name: 'cart',
  initial: { items: [] },
});
```

### 3. Use it in your app

```tsx
// Cart.tsx
import { useSharedStore } from 'tabcoord-react';
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

### 4. Open two tabs

Add an item in Tab A. It appears in Tab B automatically. That's it.

---

## Features

### Shared State

The core feature. Create a store, and all tabs share the same state.

```typescript
const store = createSharedStore({
  name: 'counter',
  initial: { count: 0 },
});

// Tab A
store.set({ count: 1 });

// Tab B — automatically shows count: 1
const count = useSharedStore(store, s => s.count);
```

### Leader Election

One tab becomes the "leader" — useful for background tasks like polling or syncing.

```typescript
import { leaderElection } from 'tabcoord';

const election = leaderElection('my-leader');

election.onElected(() => {
  console.log('This tab is the leader!');
  startBackgroundSync();
});

election.onDemoted(() => {
  console.log('Lost leadership');
  stopBackgroundSync();
});
```

### Lock Manager

Prevent two tabs from doing the same thing at the same time.

```typescript
import { lockManager } from 'tabcoord';

const lock = lockManager('my-lock');

await lock.acquire(async () => {
  // Only one tab runs this at a time
  await doExpensiveWork();
});
```

### Event Bus

Send events between tabs with wildcard matching.

```typescript
import { eventBus } from 'tabcoord';

const bus = eventBus('my-events');

// Tab A
bus.emit('user:login', { userId: 123 });

// Tab B
bus.on('user:*', (event) => {
  console.log(event.type); // 'user:login'
});
```

### Persistence

State survives page reload. Configure it like this:

```typescript
const store = createSharedStore({
  name: 'cart',
  initial: { items: [] },
  persist: { version: 1 },
});
```

---

## How It Works

1. **Same origin only** — tabs must be on the same website
2. **BroadcastChannel** — uses the browser's built-in tab messaging (with localStorage fallback)
3. **Logical clock** — each write gets a timestamp so tabs agree on which version is newest
4. **Bootstrap handshake** — when a new tab opens, it asks existing tabs for the current state

No server needed. No WebSocket. Just browser tabs talking to each other.

---

## Comparison with Alternatives

### vs Native BroadcastChannel

The browser's built-in API for tab messaging.

| Feature | tabcoord | Native BroadcastChannel |
|---------|----------|------------------------|
| State sync | ✅ Built-in | ❌ Manual |
| Persistence | ✅ Automatic | ❌ Manual |
| Leader election | ✅ Built-in | ❌ Manual |
| Lock manager | ✅ Built-in | ❌ Manual |
| Fallback | ✅ localStorage | ❌ None |
| SSR support | ✅ Noop stores | ❌ Browser only |
| Bundle size | 4.78 KB | 0 KB |

**Use tabcoord when** you need state management, leader election, or locks.  
**Use native BroadcastChannel when** you just need simple message passing.

### vs `broadcast-channel` (pubkey, 2k stars, 3M+ weekly downloads)

A BroadcastChannel polyfill with leader election.

| Feature | tabcoord | broadcast-channel |
|---------|----------|-------------------|
| State sync | ✅ Built-in | ❌ Manual |
| Persistence | ✅ Automatic | ❌ Manual |
| Lock manager | ✅ Built-in | ❌ Manual |
| Event bus | ✅ Built-in | ❌ Manual |
| SSR support | ✅ Noop stores | ❌ Browser only |
| Node.js | ❌ SSR only | ✅ Full support |
| Bundle size | 4.78 KB | 8.2 KB |
| Dependencies | 0 | 4 |

**Use tabcoord when** you need the full coordination layer.  
**Use broadcast-channel when** you need a polyfill for old browsers or Node.js IPC.

### vs `channel-state`

A lightweight cross-tab state sync library.

| Feature | tabcoord | channel-state |
|---------|----------|---------------|
| State sync | ✅ | ✅ |
| Leader election | ✅ | ❌ |
| Lock manager | ✅ | ❌ |
| Event bus | ✅ | ❌ |
| Persistence | ✅ | ❌ |
| SSR support | ✅ | ❌ |
| Active maintenance | ✅ | ⚠️ Low activity |

**Use tabcoord when** you need more than just state sync.  
**Use channel-state when** you only need basic cross-tab state.

### vs WebSocket / Server-based solutions

| Feature | tabcoord | WebSocket |
|---------|----------|-----------|
| Setup | Zero config | Server required |
| Latency | <5ms | 50-200ms |
| Multi-user | ❌ Single user | ✅ Multi-user |
| Offline | ✅ Works offline | ❌ Needs server |
| Scalability | Limited to browser tabs | Unlimited |

**Use tabcoord when** it's one person's tabs on one machine.  
**Use WebSocket when** you need multi-user collaboration.

---

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 54+ | ✅ Full |
| Firefox | 38+ | ✅ Full |
| Safari | 16+ | ✅ Full |
| Edge | 79+ | ✅ Full |
| Opera | 41+ | ✅ Full |
| Safari iOS | 15.4+ | ✅ Full |
| Chrome Android | 54+ | ✅ Full |
| Samsung Internet | 6.0+ | ✅ Full |
| IE 11 | — | ❌ Not supported |
| Node.js | 18+ | ⚠️ SSR only |

---

## Bundle Size

| Package | Gzipped | Dependencies |
|---------|---------|--------------|
| tabcoord | 4.78 KB | 0 |
| tabcoord-react | 0.9 KB | tabcoord, react |

---

## Demos

Run any demo to see it in action:

```bash
pnpm --filter @tabcoord/demo-shared-cart dev       # Shopping cart
pnpm --filter @tabcoord/demo-auth-sync dev          # Auth sync
pnpm --filter @tabcoord/demo-background-sync dev    # Leader election
pnpm --filter @tabcoord/demo-distributed-form dev   # Field merge
```

---

## When NOT to Use This

- **Single tab only** — no benefit
- **Multiple users** — this is for one person's tabs, not collaboration
- **Cross-device** — same browser only
- **Large state (>5MB)** — localStorage has limits
- **Simple message passing** — use native BroadcastChannel instead

---

## License

MIT — see [LICENSE](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
