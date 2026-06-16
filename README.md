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

Open your app in two browser tabs. Change something in one tab — it appears in the other instantly. No server. No WebSocket. Just browser tabs talking to each other through `BroadcastChannel` (with `localStorage` fallback).

## Features

| Feature | Description |
|---------|-------------|
| **Shared State** | Read/write state across tabs with instant sync |
| **Leader Election** | One tab becomes "the leader" for background tasks |
| **Lock Manager** | Prevent two tabs from doing the same thing at once |
| **Event Bus** | Send events between tabs with wildcard pattern matching |
| **Persistence** | State survives page reload via localStorage |
| **SSR Support** | Works in Next.js, Remix, Nuxt — noop stores on server |

## Install

```bash
npm install tabcoord
```

## Quick Start

```typescript
import { createSharedStore } from 'tabcoord';

const store = createSharedStore({
  name: 'counter',
  initial: { count: 0 },
});

// Read
store.get(); // { count: 0 }

// Write (syncs to all tabs)
store.set({ count: 1 });

// Update with a function
store.set(s => ({ count: s.count + 1 }));

// Subscribe to changes
const unsubscribe = store.subscribe((state) => {
  console.log(state);
});

// Clean up
store.destroy();
```

## React Integration

```bash
npm install tabcoord-react
```

```tsx
import { createSharedStore } from 'tabcoord';
import { useSharedStore } from 'tabcoord-react';

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

See [packages/react/README.md](packages/react/README.md) for full React API docs.

## Leader Election

```typescript
import { leaderElection } from 'tabcoord';

const election = leaderElection('my-app');

election.onElected(() => {
  console.log('This tab is the leader');
  startBackgroundSync();
});

election.onDemoted(() => {
  console.log('Lost leadership');
  stopBackgroundSync();
});
```

Uses Web Locks API when available, falls back to heartbeat-based election.

## Lock Manager

```typescript
import { lockManager } from 'tabcoord';

const lock = lockManager('data-write');

// Only one tab runs this at a time
await lock.acquire(async () => {
  await writeCriticalData();
});

// Non-blocking check
const acquired = await lock.tryAcquire(async () => {
  await doWork();
});
```

## Event Bus

```typescript
import { eventBus } from 'tabcoord';

const bus = eventBus('user-events');

// Emit
bus.emit('user:login', { userId: 123 });

// Listen with wildcard
bus.on('user:*', (event) => {
  console.log(event.type, event.payload);
});

// Listen to all events
bus.on('*', (event) => {
  console.log('Any event:', event.type);
});
```

Local subscribers receive their own emitted events. Cross-tab delivery is automatic.

## Persistence

```typescript
const store = createSharedStore({
  name: 'cart',
  initial: { items: [] },
  persist: {
    version: 1,
    prefix: 'myapp',       // optional, default: 'tabcoord'
    onRehydrate: (state, clock) => state,  // optional migration hook
  },
});
```

## Error Handling

```typescript
import { createSharedStore } from 'tabcoord';
import { StoreDestroyedError, LockTimeoutError } from 'tabcoord';

const store = createSharedStore({ name: 'app', initial: {} });
store.destroy();

// Typed errors for different failure modes
try {
  store.set({ data: 1 });
} catch (err) {
  if (err instanceof StoreDestroyedError) {
    // Store was destroyed
  }
}
```

Available error classes: `TabcoordError`, `StoreDestroyedError`, `LockTimeoutError`, `LockManagerDestroyedError`, `BootstrapTimeoutError`.

## How It Works

1. **Same origin only** — tabs must be on the same website
2. **BroadcastChannel** — uses the browser's built-in tab messaging, falls back to localStorage
3. **Logical clock** — each write gets a counter + tab ID for deterministic conflict resolution
4. **Bootstrap handshake** — new tabs ask existing tabs for current state on load
5. **Deterministic leader election** — lowest tab ID wins when multiple tabs race

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
| `tabcoord` | ~5 KB | 0 |
| `tabcoord-react` | ~1 KB | `tabcoord`, `react` |

## When NOT to Use

- **Single tab** — no benefit
- **Multiple users** — this is for one person's tabs, not real-time collaboration
- **Cross-device** — same browser only
- **Large state (>5MB)** — localStorage has quota limits

## License

MIT
