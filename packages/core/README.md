# tabcoord

**Cross-tab state sync, leader election, distributed locks, and event bus — zero dependencies.**

[![npm version](https://img.shields.io/npm/v/tabcoord.svg)](https://www.npmjs.com/package/tabcoord)

## Install

```bash
npm install tabcoord
# or just install tabcoord-react — it includes everything
npm install tabcoord-react
```

## Quick Start

```typescript
import { createSharedStore } from 'tabcoord';

const store = createSharedStore({
  name: 'counter',
  initial: { count: 0 },
});

store.get();                                    // { count: 0 }
store.set({ count: 1 });                        // syncs to all tabs
store.set(s => ({ count: s.count + 1 }));       // updater function
const unsub = store.subscribe((s) => console.log(s));
store.destroy();
```

## API

### `createSharedStore(options)`

```typescript
const store = createSharedStore({
  name: 'my-store',          // unique name
  initial: { count: 0 },     // starting value or () => value
  persist: { version: 1 },   // optional: localStorage persistence
  onError: (err) => {},      // optional: error callback
});
```

### `SharedStoreHandle`

| Method | Returns | Description |
|--------|---------|-------------|
| `store.get()` | `T \| undefined` | Get current state |
| `store.set(value)` | `void` | Set state (syncs to all tabs) |
| `store.set(fn)` | `void` | Update with function |
| `store.subscribe(fn)` | `() => void` | Listen for changes |
| `store.destroy()` | `void` | Clean up |
| `store.status` | `'bootstrap' \| 'synced'` | Store status |

### `leaderElection(name, options?)`

```typescript
const election = leaderElection('my-app', {
  heartbeatInterval: 2000,  // default: 2000ms
  timeout: 5000,            // default: 5000ms
});

election.onElected(() => { /* leader */ });
election.onDemoted(() => { /* follower */ });
election.isLeader;           // boolean
```

Uses Web Locks API when available, falls back to heartbeat-based election.

### `lockManager(name, options?)`

```typescript
const lock = lockManager('data-write', { ttl: 30000 });

await lock.acquire(async () => { await writeData(); });
await lock.acquire(fn, { timeout: 5000 });
const acquired = await lock.tryAcquire(fn);
```

### `eventBus(name, options?)`

```typescript
const bus = eventBus('events', { maxReplay: 50 });

bus.emit('user:login', { userId: 123 });          // local + cross-tab
bus.on('user:*', (e) => console.log(e.type));      // wildcard
bus.on('*', (e) => {});                             // all events
bus.on('user:*', handler, { replay: true });        // replay past events
```

### `diff` / `apply` (subpath export)

```typescript
import { diff, apply } from 'tabcoord/diff';

const patch = diff({ a: 1, b: 2 }, { a: 1, b: 3 });
const next = apply({ a: 1, b: 2 }, patch);
```

## Error Classes

```typescript
import {
  TabcoordError, StoreDestroyedError, LockTimeoutError,
  LockManagerDestroyedError, BootstrapTimeoutError,
} from 'tabcoord';
```

## Exports

```typescript
// ESM
import { createSharedStore } from 'tabcoord';

// CJS
const { createSharedStore } = require('tabcoord');

// Subpath
import { diff, apply } from 'tabcoord/diff';
```

## How It Works

1. **BroadcastChannel** with localStorage fallback
2. **Logical clock** (counter + tab ID) for conflict resolution
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

## License

MIT
