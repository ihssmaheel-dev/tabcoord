# tabcoord

**Cross-tab state sync, leader election, distributed locks, and event bus — zero dependencies.**

[![npm version](https://img.shields.io/npm/v/tabcoord.svg)](https://www.npmjs.com/package/tabcoord)

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

// Read state
store.get(); // { count: 0 }

// Write state (syncs to all tabs)
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

## API

### `createSharedStore(options)`

Creates a store that syncs across tabs. Returns a `SharedStoreHandle`.

```typescript
const store = createSharedStore({
  name: 'my-store',          // unique name for this store
  initial: { count: 0 },     // starting value or () => value
  persist: {                  // optional: save to localStorage
    version: 1,
    prefix: 'myapp',
    onRehydrate: (state, clock) => state,
  },
  onError: (err) => {},       // optional: error callback
});
```

### `SharedStoreHandle`

| Method | Returns | Description |
|--------|---------|-------------|
| `store.get()` | `T \| undefined` | Get current state |
| `store.set(value)` | `void` | Set state (syncs to all tabs) |
| `store.set(fn)` | `void` | Update with function: `s => ({ ...s, n: s.n + 1 })` |
| `store.subscribe(fn)` | `() => void` | Listen for changes, returns unsubscribe |
| `store.destroy()` | `void` | Clean up transport and subscriptions |
| `store.status` | `'bootstrap' \| 'synced'` | Current store status |

### `leaderElection(name, options?)`

Elect a leader tab for background tasks.

```typescript
import { leaderElection } from 'tabcoord';

const election = leaderElection('my-app', {
  heartbeatInterval: 2000,  // default: 2000ms
  timeout: 5000,             // default: 5000ms
});

election.onElected(() => { /* this tab is leader */ });
election.onDemoted(() => { /* lost leadership */ });
election.isLeader;           // boolean
election.destroy();          // clean up
```

Uses Web Locks API when available, falls back to heartbeat-based election.

### `lockManager(name, options?)`

Distributed lock across tabs.

```typescript
import { lockManager } from 'tabcoord';

const lock = lockManager('data-write', { ttl: 30000 });

// Acquire lock, run function, release
await lock.acquire(async () => {
  await writeCriticalData();
});

// With timeout
await lock.acquire(fn, { timeout: 5000 });

// Non-blocking check
const acquired = await lock.tryAcquire(fn);

lock.destroy();
```

### `eventBus(name, options?)`

Cross-tab event system with wildcard matching.

```typescript
import { eventBus } from 'tabcoord';

const bus = eventBus('events', { maxReplay: 20 });

// Emit (local handlers also receive this)
bus.emit('user:login', { userId: 123 });

// Listen with wildcard
bus.on('user:*', (event) => {
  console.log(event.type, event.payload);
});

// Replay past events
bus.on('user:*', handler, { replay: true });

bus.destroy();
```

### `diff` / `apply` (subpath export)

```typescript
import { diff, apply } from 'tabcoord/diff';

const patch = diff({ a: 1, b: 2 }, { a: 1, b: 3 });
// patch = { $patch: true, b: 3 }

const next = apply({ a: 1, b: 2 }, patch);
// next = { a: 1, b: 3 }
```

## Error Classes

All errors extend `TabcoordError`:

```typescript
import {
  TabcoordError,
  StoreDestroyedError,
  LockTimeoutError,
  LockManagerDestroyedError,
  BootstrapTimeoutError,
} from 'tabcoord';
```

## Exports

The package supports both ESM and CJS:

```typescript
// ESM
import { createSharedStore } from 'tabcoord';

// CJS
const { createSharedStore } = require('tabcoord');

// Subpath
import { diff, apply } from 'tabcoord/diff';
```

## How It Works

1. **BroadcastChannel** for fast cross-tab messaging, falls back to localStorage
2. **Logical clock** (counter + tab ID) for deterministic conflict resolution
3. **Bootstrap handshake** — new tabs request state from existing tabs
4. **Deterministic leader election** — lowest tab ID wins ties

## License

MIT
