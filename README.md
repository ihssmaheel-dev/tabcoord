# tabcoord

**Cross-tab state sync, leader election, distributed locks, and event bus — zero dependencies.**

[![npm version](https://img.shields.io/npm/v/tabcoord.svg)](https://www.npmjs.com/package/tabcoord)
[![npm downloads](https://img.shields.io/npm/dm/tabcoord.svg)](https://www.npmjs.com/package/tabcoord)
[![license](https://img.shields.io/npm/l/tabcoord.svg)](https://www.npmjs.com/package/tabcoord)

```typescript
import { createSharedStore } from 'tabcoord';

const cart = createSharedStore({ name: 'cart', initial: { items: [] } });

// Tab A
cart.set({ items: ['Widget'] });

// Tab B — automatically shows { items: ['Widget'] }
```

## What It Does

Open your app in two browser tabs. Change something in one tab — it appears in the other instantly. No server. No WebSocket. Just browser tabs talking to each other.

## Install

```bash
# React projects — one install, everything included
npm install tabcoord-react

# Vanilla JS / Node.js
npm install tabcoord
```

## Features

| Feature | Description |
|---------|-------------|
| **Shared State** | Read/write state across tabs with instant sync |
| **Leader Election** | One tab becomes "the leader" for background tasks |
| **Lock Manager** | Prevent two tabs from doing the same thing at once |
| **Event Bus** | Send events between tabs with wildcard pattern matching |
| **Persistence** | State survives page reload via localStorage |
| **SSR Support** | Works in Next.js, Remix, Nuxt — noop stores on server |

## Quick Start

```typescript
import { createSharedStore } from 'tabcoord';

const store = createSharedStore({
  name: 'counter',
  initial: { count: 0 },
});

store.set({ count: 1 });                        // syncs to all tabs
store.set(s => ({ count: s.count + 1 }));       // updater function
const unsub = store.subscribe((s) => console.log(s));
store.destroy();
```

## React (single install)

```bash
npm install tabcoord-react
```

```tsx
import { createSharedStore, useSharedStore } from 'tabcoord-react';

const cart = createSharedStore({ name: 'cart', initial: { items: [] } });

function Cart() {
  const items = useSharedStore(cart, s => s.items);
  return (
    <button onClick={() => cart.set(s => ({ items: [...s.items, 'Widget'] }))}>
      Add ({items.length})
    </button>
  );
}
```

All core APIs are re-exported from `tabcoord-react`:

```tsx
import {
  // React hooks
  useSharedStore, useSharedEvent, createStoreContext,
  // Core APIs
  createSharedStore, eventBus, leaderElection, lockManager,
} from 'tabcoord-react';
```

## Leader Election

```typescript
import { leaderElection } from 'tabcoord';

const election = leaderElection('my-app');

election.onElected(() => { /* leader */ });
election.onDemoted(() => { /* follower */ });
```

## Lock Manager

```typescript
import { lockManager } from 'tabcoord';

const lock = lockManager('data-write');

await lock.acquire(async () => {
  await writeCriticalData();
});
```

## Event Bus

```typescript
import { eventBus } from 'tabcoord';

const bus = eventBus('user-events');

bus.emit('user:login', { userId: 123 });
bus.on('user:*', (event) => console.log(event.type, event.payload));
bus.on('*', (event) => console.log('Any event:', event.type));
```

## Persistence

```typescript
const store = createSharedStore({
  name: 'cart',
  initial: { items: [] },
  persist: { version: 1 },
});
```

## How It Works

1. **BroadcastChannel** with localStorage fallback
2. **Logical clock** for deterministic conflict resolution
3. **Bootstrap handshake** — new tabs request state from existing tabs
4. **Deterministic leader election** — lowest tab ID wins ties

## Browser Support

| Browser | Minimum Version |
|---------|----------------|
| Chrome | 54+ |
| Firefox | 38+ |
| Safari | 16+ |
| Edge | 79+ |
| Node.js | 18+ (SSR only) |

## Bundle Size

| Package | Gzipped | Dependencies |
|---------|---------|--------------|
| `tabcoord` | ~6 KB | 0 |
| `tabcoord-react` | ~1 KB | `tabcoord`, `react` |

## When NOT to Use

- **Single tab** — no benefit
- **Multiple users** — this is for one person's tabs, not real-time collaboration
- **Cross-device** — same browser only
- **Large state (>5MB)** — localStorage has quota limits

## License

MIT
