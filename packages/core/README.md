# tabcoord

**Sync state across browser tabs. One line of code.**

[![npm version](https://img.shields.io/npm/v/tabcoord.svg)](https://www.npmjs.com/package/tabcoord)
[![license](https://img.shields.io/npm/l/tabcoord.svg)](https://www.npmjs.com/package/tabcoord)

```typescript
import { createSharedStore } from 'tabcoord';

const cart = createSharedStore({ name: 'cart', initial: { items: [] } });
// Two tabs. Instant sync. No server. Done.
```

## What is this?

TabCoord lets you share state between browser tabs. Open your app in two tabs — change something in one tab, and it appears in the other instantly. No server needed. No WebSocket. Just browser tabs talking to each other.

## Install

```bash
npm install tabcoord
```

## Quick Start

```typescript
import { createSharedStore } from 'tabcoord';

// Create a store
const cart = createSharedStore({
  name: 'cart',
  initial: { items: [] },
});

// Read state
const state = cart.get();

// Write state (syncs to all tabs)
cart.set({ items: ['Widget'] });

// Update with a function
cart.set(s => ({ items: [...s.items, 'Gadget'] }));

// Subscribe to changes
const unsubscribe = cart.subscribe((newState) => {
  console.log('State changed:', newState);
});
```

## Features

| Feature | Description |
|---------|-------------|
| **Shared State** | Read/write state across tabs — changes sync instantly |
| **Leader Election** | One tab becomes the "leader" for background tasks |
| **Lock Manager** | Prevent two tabs from doing the same thing at once |
| **Event Bus** | Send events between tabs with wildcard matching |
| **Persistence** | State survives page reload (localStorage) |
| **SSR Support** | Works in Next.js, Remix, etc. |

## How It Works

1. **Same origin only** — tabs must be on the same website
2. **BroadcastChannel** — uses the browser's built-in tab messaging (with localStorage fallback)
3. **Logical clock** — each write gets a timestamp so tabs agree on which version is newest
4. **Bootstrap handshake** — when a new tab opens, it asks existing tabs for the current state

No server needed. No WebSocket. Just browser tabs talking to each other.

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

### `eventBus(name)`

Send events between tabs:

```typescript
import { eventBus } from 'tabcoord';

const bus = eventBus('my-events');
bus.emit('user:login', { userId: 123 });
bus.on('user:*', (event) => console.log(event));
```

### `leaderElection(name)`

Elect a leader tab:

```typescript
import { leaderElection } from 'tabcoord';

const election = leaderElection('my-leader');
election.onElected(() => {
  console.log('This tab is the leader!');
  startBackgroundSync();
});
```

### `lockManager(name)`

Lock to prevent two tabs from doing the same thing:

```typescript
import { lockManager } from 'tabcoord';

const lock = lockManager('my-lock');
await lock.acquire(async () => {
  await doExpensiveWork();
});
```

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 54+ | ✅ Full |
| Firefox | 38+ | ✅ Full |
| Safari | 16+ | ✅ Full |
| Edge | 79+ | ✅ Full |
| Node.js | 18+ | ⚠️ SSR only |

## Bundle Size

- **tabcoord**: 4.78 KB gzipped, zero dependencies

## When NOT to use this

- **Single tab only** — no benefit
- **Multiple users** — this is for one person's tabs, not collaboration
- **Cross-device** — same browser only
- **Large state (>5MB)** — localStorage has limits

## License

MIT
