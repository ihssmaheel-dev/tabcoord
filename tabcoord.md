# Browser Tab Sync Framework — Master Plan (Final, v9)

## Positioning

**"The coordination layer multi-tab apps are missing."**

100% open source, MIT, no monetization. Shared store is the entry point; leader election, distributed locks, and an event bus with replay are the actual differentiators — none exist in `channel-state` (14 stars, v0.0.5) or any other competing package.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│   PUBLIC API                                  │
│   createSharedStore · useSharedStore          │
│   eventBus · lockManager · leaderElection     │
├──────────────────────────────────────────────┤
│   TRANSPORT — BroadcastChannel (v1)           │
│   + localStorage/storage-event fallback       │
│   + no-op fallback for non-browser (SSR)      │
├──────────────────────────────────────────────┤
│   CORE — logical clock · LWW merge ·          │
│   bootstrap handshake · diff/patch · errors   │
└──────────────────────────────────────────────┘
```

One transport, one merge strategy for v1. Everything else is additive on a correct foundation.

---

## Package Structure

```
packages/
  core/       @tabcoord/core      — <5kb gz, zero deps (CI-enforced)
  react/      @tabcoord/react     — useSharedStore, useSharedEvent, createStoreContext
  vue/        @tabcoord/vue       — composables, same surface as react (planned)
  schema/     @tabcoord/schema    — optional Zod integration (planned)
  list/       @tabcoord/list      — syncedList() OR-Set CRDT (planned)
  devtools/   @tabcoord/devtools  — debug overlay + time-travel (planned)

demos/
  shared-cart/     — Shared shopping cart (v0.1.0)
  auth-sync/       — Auth sync (v0.1.0)
  background-sync/ — Leader-only polling (v0.5.0)
  distributed-form/— Field-level merge (v0.5.0)
  ssr-smoke/       — Node.js SSR smoke test (v0.1.0)
  multiplayer-cursor/ — syncedList showcase (v1.0.0, planned)
```

`@tabcoord/core` alone is a complete, useful library.

---

## Implementation Decision: SSR Instance Swap

The `_instanceCache` swap (SSR no-op → real client instance) is implemented as a **wrapper class forwarding every method**, not a `Proxy`. Explicit, debuggable, no `this`-binding surprises with method extraction (`const { set } = cart`), tree-shakes cleanly.

```typescript
class SharedStoreHandle<T> {
  constructor(private name: string, fallback?: T) {}
  get(): T {
    const inst = getInstance(this.name);
    if (inst) return inst.get();
    if (this._fallback !== undefined) return this._fallback;
    return undefined as T;
  }
  set(v: T | ((s: T) => T)): void { getInstance(this.name)?.set(v); }
  subscribe(fn: (s: T) => void): () => void { return getInstance(this.name)?.subscribe(fn) ?? (() => {}); }
  destroy(): void { getInstance(this.name)?.destroy(); deleteInstance(this.name); clearFactoryCache(this.name); }
  get status(): 'bootstrap' | 'synced' { return getInstance(this.name)?.status ?? 'synced'; }
}
```

Every export of `createSharedStore` is a `SharedStoreHandle`. The underlying real/no-op instance lives in `_instanceCache` keyed by `name` and is swapped transparently on first client-side access — the handle itself never changes identity, so module-scope exports and `useSharedStore` references stay valid across SSR→hydration.

---

## Wire Protocol

Every message: `_meta: { id, type, source: tabId, timestamp, clock }`.

| Type | Direction | Purpose |
|---|---|---|
| `sync-request` | new tab → all | Announce join, `tabId` + `knownClock` |
| `sync-response` | existing tabs → new tab | Current state snapshot + highest clock |
| `state-snapshot` | payload | Full state, chunked if >64KB |
| `sync-ack` | new tab → all | Confirms caught up |
| `state-patch` | any → all | Normal write broadcast (diff/patch or full state) |
| `heartbeat` | all tabs → all | `{ tabId, ts }` — leader election liveness |
| `lock-request` / `lock-grant` / `lock-release` | lock participants | FIFO mutex protocol |

**Chunking:** chunks shaped `{ _meta: { id, chunkIndex, totalChunks }, payload }`. Receiver buffer: `{ chunks: Map<number, string>, resolved: boolean, timeoutHandle }`. Final chunk or 2s timeout — whichever fires first sets `resolved = true` and acts; the other is a no-op. 64KB threshold leaves margin under Safari's ~256KB BroadcastChannel limit.

**Join sequence:**
1. Generate per-session `tabId` (`crypto.randomUUID()` + fallback for old Safari)
2. Jitter 50–200ms
3. Broadcast `sync-request`
4. Queue writes during hold period (not applied)
5. On `sync-response` (within 500ms): apply received state `S`, then **replay queued writes on top of `S`, in order** — never reversed
6. Broadcast `sync-ack` and final state
7. On timeout: fresh-init from resolved `initial`, flush queue on top, broadcast state

This closes the critical bug where a late-joining tab's empty initial state could LWW-overwrite an existing tab's data.

**Dual-leader prevention:** Bootstrap tabs can respond to sync-requests with clock comparison and tabId tiebreak — lowest tabId yields, preventing two tabs from simultaneously becoming "first tab".

---

## SSR / Non-Browser Environments

**Detection:**
```typescript
const isBrowser = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined';
```

**Server:** `createSharedStore` registers a no-op instance in `_instanceCache` — `get()` returns resolved `initial`, `set()` updates in-memory and notifies subscribers, `subscribe()` works locally, `status` is always `'synced'`.

**Client:** the first `useSharedStore` mount (guaranteed client-side) promotes the cache entry from no-op to a real `@tabcoord/core` instance, which runs the full bootstrap handshake. The `SharedStoreHandle` returned at module scope is unchanged — only what it delegates to changes.

**Documented pattern:**
- ✅ `export const cart = createSharedStore({...})` at module scope; use `useSharedStore(cart, selector)` everywhere.
- ❌ Do not do `React.createContext(cart)` — a `SharedStoreHandle` works fine through Context since its identity never changes, but if a Context wrapper is wanted for testing/mocking, use the provided `createStoreContext()` helper rather than rolling your own, since it documents the swap timing explicitly.

Server output reflects only resolved `initial` — never live cross-tab state, which doesn't exist at request time.

---

## Known Limitations

### Dynamic `initial` and first-tab race

```typescript
// ❌ Avoid — re-evaluated on first-tab race, causes split-brain
const store = createSharedStore({
  name: 'session',
  initial: { sessionId: crypto.randomUUID(), items: [] },
});

// ✅ Correct — one-shot factory
const store = createSharedStore({
  name: 'session',
  initial: () => ({ sessionId: crypto.randomUUID(), items: [] }),
});
```

### `initial` resolution order

```typescript
const _factoryCache = new Map<string, unknown>();

function resolveInitial<T>(
  name: string,
  initial: T | (() => T),
  persistConfig?: PersistConfig
): T {
  const prefix = persistConfig?.prefix ?? 'tabcoord';
  // 1. Persisted state from a real previous session — source of truth
  if (persistConfig) {
    const stored = rehydrateState(name, prefix);
    if (stored !== undefined) return stored.state;
  }
  // 2. HMR cache — module reloaded in dev, factory already ran once
  if (_factoryCache.has(name)) return _factoryCache.get(name) as T;
  // 3. True cold start
  const result = typeof initial === 'function' ? (initial as () => T)() : initial;
  _factoryCache.set(name, result);
  return result;
}
```

Storage wins over cache wins over factory — a returning user's persisted `sessionId` is never discarded for a freshly-generated one, and HMR reloads in dev don't regenerate it either.

---

## Core Module Specs

### 1. `createSharedStore`

```typescript
import { createSharedStore } from '@tabcoord/core';
import { useSharedStore } from '@tabcoord/react';

const cart = createSharedStore({
  name: 'cart',
  initial: { items: [] as string[], updatedAt: 0 },
  mergeStrategy: 'whole', // 'whole' | 'field' (shallow, one level)
  persist: {
    version: 1,
    prefix: 'tabcoord', // → tabcoord:v1:cart:state
    onRehydrate: (stored, clock) => stored.version < 1 ? migrateV0toV1(stored) : stored,
  },
  onError: (err) => reportToSentry(err),
});

function CartButton() {
  const items = useSharedStore(cart, s => s.items);
  if (cart.status === 'bootstrap') return <Spinner />;

  return (
    <button onClick={() => cart.set(s => ({
      items: [...s.items, 'sku-123'],
      updatedAt: Date.now(),
    }))}>
      Add ({items.length})
    </button>
  );
}
```

**Merge semantics:**
- Logical clock `(counter, tabId)`. `tabId`: `crypto.randomUUID()` + fallback, **per-session, never persisted/reused**. Equal-clock tiebreak: lexicographic `tabId`.
- `'whole'` (default): latest write wins, whole object. `'field'`: shallow, **one level deep only** — nested objects are atomic.
- Arrays are values (replace-whole). Collaborative arrays → `@tabcoord/list`'s `syncedList()`.
- **Serialization contract:** JSON-serializable only. `Date` → ISO string, not revived. `Map`/`Set`/`RegExp`/functions/`BigInt` unsupported. BroadcastChannel uses `structuredClone`; `syncStorage` uses JSON — JSON is the binding contract.
- **Reserved keys:** User payloads passed to `set()` are stripped of `_meta` and `$tabcoord` keys before storing — those namespaces belong to the framework. A `set()` call with `{ _meta: anything, $tabcoord: anything }` silently drops both keys.
- **Diff/Patch:** `set()` computes a shallow diff and sends only changed fields. The `state-patch` handler detects patches vs full state and applies accordingly. Backward compatible — full state still works.

**`set()` — both forms (Zustand-style):**
```typescript
cart.set({ items: ['sku-123'], updatedAt: Date.now() }); // direct value
cart.set(s => ({ ...s, items: [...s.items, 'sku-123'] })); // updater fn
```

**`status: 'bootstrap' | 'synced'`:** Accessible only on the handle (`cart.status`). `'bootstrap'` between construction and sync resolution — `get()` returns resolved `initial`, never `undefined`/throws. `'synced'` once real state applied or this tab confirmed first/fresh. Always `'synced'` immediately on SSR. The state object itself has no `status` field — selectors never see it.

**`persist` config:**
```typescript
type PersistConfig = {
  version: number;
  prefix?: string; // default 'tabcoord'
  onRehydrate?: (stored: unknown, clock: Clock) => State;
};
```

**`destroy()`:**
```typescript
cart.destroy();
// closes BroadcastChannel, clears intervals/TTLs, unsubscribes syncStorage,
// removes from _instanceCache and _factoryCache
```
Post-`destroy()`, `set()`/`get()` are no-ops with a dev console warning. Re-`createSharedStore` with the same `name` constructs fresh and re-bootstraps.

**Error handling (`onError`):**

| Failure | Behavior |
|---|---|
| `localStorage` quota exceeded (`QuotaExceededError`) | In-memory fallback |
| `localStorage` write-blocked (`SecurityError`, Safari private browsing) | In-memory fallback, distinct error code |
| `BroadcastChannel` unavailable | Fall back to `localStorage` + `storage` event |
| Oversized payload | Chunked per wire protocol |
| Corrupted persisted JSON | Clear entry, fall back to `initial` |
| Tab killed silently | Leader election heartbeat timeout |
| Sync chunk reassembly timeout | `onTimeout` callback; discard, fresh-init |
| Server-side construction | No-op store, no error emitted |

### 2. `eventBus`

```typescript
const bus = eventBus('app-events');
const unsubscribe = bus.on('user:*', handler, { replay: true });
bus.emit('user:logout', { reason: 'manual' });
unsubscribe();
bus.destroy();
```
- Every event: `{ ...payload, _meta: { id, type, source, timestamp } }`. `_meta` and `$tabcoord` are reserved — `emit()` silently strips them from the payload if present.
- `bus.on()` always returns `unsubscribe()`.
- Replay ring buffer (default N=20) backed by in-memory store. Tradeoff: a tab asleep through 21+ events permanently misses overflow (documented).

### 3. `leaderElection`

```typescript
const election = leaderElection('poll-leader', {
  heartbeatInterval: 2000, // 5000 for Safari background-tab presets
  timeout: 5000,           // 15000 for Safari
});

election.onElected(() => {
  const interval = setInterval(pollServer, 30_000);
  election.onDemoted(() => clearInterval(interval));
});

election.destroy();
```
- Primary: heartbeat broadcast; lowest-`tabId` among tabs heard within `timeout` wins.
- **Web Locks acceleration:** `navigator.locks.request()` when available — instant leadership, heartbeat becomes liveness-only. Falls back to heartbeat if lock acquisition fails, with automatic retry.
- `pagehide`/`visibilitychange` → immediate step-down (heartbeat mode only; Web Locks handles visibility internally).
- Frozen (not killed) leader: detected via timeout; held locks handled by lock TTL, not election itself.
- `tabId` strictly per-session — no stale-leader reclaim on reopen.

### 4. `lockManager`

```typescript
const lock = lockManager('expensive-import');

await lock.acquire(async () => {
  await runExpensiveImport();
}, { timeout: 10_000 }); // TTL auto-release

const got = await lock.tryAcquire(() => doThing());
lock.destroy();
```
- FIFO queue via `lock-request`/`lock-grant`/`lock-release`.
- TTL auto-release (default 30s) — covers frozen/crashed holder. Queue continues on tab crash (release handler clears holder and grants to next).
- **Reentrancy:** per-tab counter keyed by `(tabId, lockName)`. Re-`acquire()` by the holding tab increments and resolves immediately without re-queueing; `release()` decrements, only broadcasting `lock-release` at zero.

### 5. `syncStorage`

```typescript
await syncStorage.setItem('auth-token', token, { ttl: 3600_000 });
const token = await syncStorage.getItem('auth-token');
```
- Async wrapper over `localStorage` + BroadcastChannel change events, falls back to `storage` event.
- Versioned namespacing: `tabcoord:v1:<key>`.
- Optional Zod validation via `@tabcoord/schema` (peer dep, not bundled).
- Backs eventBus replay buffer. No encryption-at-rest in v1 (documented non-goal).

---

## Developer Experience

```typescript
// Entire integration, two tabs, working:
import { createSharedStore } from '@tabcoord/core';
import { useSharedStore } from '@tabcoord/react';

export const cart = createSharedStore({ name: 'cart', initial: { items: [] } });

const items = useSharedStore(cart, s => s.items);
```

**Built into core:** `?tabcoord=debug` structured console logs (`[tabcoord:<tabId>] msg data`), `window.__tabcoord` global exposing tab ID and per-store clock/status.

**`@tabcoord/devtools` (Phase 3):** browser extension — tab map, leader indicator, lock queue viz, time-travel debugger.

---

## Phased Roadmap

### Phase 1 — Foundation + Correctness → `v0.1.0` ✅

- [x] `@tabcoord/core`: BroadcastChannel transport + localStorage/storage-event fallback + SSR no-op
- [x] Logical clock, per-session `tabId` (`crypto.randomUUID()` + fallback), lexicographic tiebreak
- [x] Bootstrap protocol: sync-request/response/ack, jitter, sync-then-replay write queue
- [x] Dual-leader prevention via clock comparison and tabId tiebreak
- [x] Chunking: sequence-numbered chunks, `resolved`-flag race prevention, 2s reassembly timeout
- [x] Diff/Patch integration: `set()` sends patches, handler applies diffs or full state
- [x] `createSharedStore`:
  - [x] `'whole'` merge
  - [x] `set(value)` and `set(fn)`
  - [x] `initial: T | (() => T)`, resolution order: storage → HMR cache → factory
  - [x] `status: 'bootstrap' | 'synced'`
  - [x] versioned persistence (`tabcoord:v1:<name>:state`), `onRehydrate`, `onError`
  - [x] Persist key fix: reads and writes use same localStorage key
  - [x] `destroy()` + `_instanceCache` + **`SharedStoreHandle` wrapper class** for SSR swap
- [x] `syncStorage` (reuses single BroadcastChannel, caches storage probe)
- [x] `eventBus` (wildcards, `_meta`, `unsubscribe`, replay, `destroy()`)
- [x] `@tabcoord/react`: `useSharedStore` (useMemo for getSnapshot, SSR-safe), `useSharedEvent`, `createStoreContext()` (auto-destroy on unmount)
- [x] CI: `size-limit` (<5kb gz, zero deps)
- [x] Docs: README, serialization contract, static-vs-factory initial, Safari fallback, SSR pattern, destroy lifecycle
- [x] **Demo 0:** SSR smoke test (Node.js, 15 tests)
- [x] **Demo 1:** Shared shopping cart
- [x] **Demo 2:** Auth sync
- [x] Playwright multi-context harness
- [x] Bug fixes: 33 issues fixed (persist key mismatch, queued writes broadcast, WeakRef primitive bug, lock crash queue stuck, Web Locks retry, clock comparison, handle.get safety, storage-events window guard, E2E flakiness)

**Exit criteria:** ✅ Demos 1/2 pass. 76 unit tests, 13 React tests, 15 SSR smoke tests, 13 E2E tests. Bundle <5kb gz enforced.

---

### Phase 2 — Coordination Primitives → `v0.5.0` (In Progress)

- [x] `leaderElection` — heartbeat (configurable, Safari preset), Web Locks acceleration with retry, visibility step-down, per-session `tabId`, `destroy()`
- [x] `lockManager` — FIFO, TTL auto-release, per-tab reentrancy counter, crash recovery via release handler, `destroy()`
- [x] Diff/Patch integration — `set()` sends patches, `state-patch` handler applies diffs
- [ ] `mergeStrategy: 'field'` — shallow one-level merge (implemented but reverted due to bidirectional sync issues; needs re-implementation)
- [ ] `@tabcoord/schema` — Zod integration (planned)
- [ ] `@tabcoord/vue` — composables mirroring React API (planned)
- [x] **Demo 3:** Background sync (leader-only polling)
- [x] **Demo 4:** Distributed form (field-level merge)
- [x] E2E: Leader election (3 tests), Lock manager (2 tests)

**Exit criteria:** Leader election and lock manager working with E2E tests. Field-level merge deferred to after v0.5.0 stability.

---

### Phase 3 — Polish, Scale & Differentiation → `v1.0.0` (Planned)

- [ ] `@tabcoord/list` — `syncedList()` OR-Set CRDT
- [ ] `@tabcoord/devtools` — debug overlay + time-travel
- [ ] Broadcast scaling: write coalescing, self-throttling, receive-debounce
- [ ] 50-tab Playwright load test
- [ ] Documentation site (VitePress): browser compat table, performance benchmarks, honest `channel-state` comparison, "When NOT to use this"
- [ ] 90% coverage core-wide, 100% on clock/merge/bootstrap/election/lock/chunking
- [ ] **Demo 5:** Multiplayer cursor (syncedList + eventBus)
- [ ] `@tabcoord/svelte` (community-contributable)

**Exit criteria:** `npm i @tabcoord/core` → working 2-tab cart, under 60s, fresh-machine verified. 50-tab load test passes with coalescing active.

---

### Someday / Maybe
- SharedWorker transport (single channel instead of N² BroadcastChannel)
- IndexedDB/OPFS persistence for state larger than localStorage limits
- Solid adapter
- Community-run, self-hostable cross-device relay

---

## Demos (Final Set)

0. **SSR Smoke Test** (P1) ✅ — Node.js script, 15 tests, no browser needed
1. **Shared Shopping Cart** (P1) ✅ — late-join correctness, `status` UI
2. **Auth Sync** (P1) ✅ — logout everywhere
3. **Background Sync** (P2) ✅ — leaderElection showcase
4. **Distributed Form** (P2) ✅ — field-merge showcase
5. **Multiplayer Cursor** (P3) — syncedList + eventBus showcase

Demos 3 and 5 are the ones that justify the project's existence — lead with these on the landing page.

---

## When NOT to Use This Library

- **Single-tab apps** — pure overhead, zero benefit.
- **Cross-device sync** — same-origin, same-browser-instance only. Need a server/WebSocket layer (out of scope, "Someday/Maybe").
- **Real-time multi-*user* collaboration** — `@tabcoord/list`'s CRDT is for one user's own tabs, not a Yjs/Automerge replacement.
- **Guaranteed delivery during tab sleep** — eventBus replay window is fixed (default 20); beyond that, events are permanently lost.
- **Multi-megabyte state** — `localStorage`-backed (5-10MB quota); chunking isn't designed for MB-scale payloads.
- **SSR apps needing live cross-tab data at render time** — server output reflects only resolved `initial`.
- **SPAs creating many per-entity stores without calling `destroy()`** — e.g., a per-document store in a multi-doc editor leaks a BroadcastChannel per undestroyed instance.

---

## Test Coverage

| Package | Unit Tests | E2E Tests | Total |
|---------|-----------|-----------|-------|
| `@tabcoord/core` | 76 | 13 | 89 |
| `@tabcoord/react` | 13 | — | 13 |
| SSR smoke | 15 | — | 15 |
| **Total** | **104** | **13** | **117** |

---

## North Star Metric

*"Time from `npm i` to working shared state in 2 tabs"* → **under 60 seconds** — including the case where Tab B opens after Tab A already has state, and Tab A's data is never wiped.

---

## What Makes This Work Really Well

- **The #1 silent-data-loss bug (late-join LWW wipe) is fixed before `v0.1.0`**, with apply-order explicitly specified.
- **Dual-leader prevention** via clock comparison and tabId tiebreak — two simultaneous tab opens never both become "first tab".
- **Diff/Patch integration** — `set()` sends only changed fields, reducing bandwidth for large stores.
- **Every "what about X?" question — serialization, persistence versioning, merge depth, clock ties, chunking races, HMR, SSR identity, lifecycle leaks — has a documented, concrete answer**, not a hand-wave.
- **Correctness has automated tests from day one**: late-join, leader-kill, lock-crash, corrupted-storage, BroadcastChannel-unavailable, SSR swap, chunking race, `destroy()`.
- **Wire protocol, storage format, `initial` contract, and lifecycle are all locked correctly at `v0.1.0`** — no anticipated breaking changes through `v1.0.0`.
- **Differentiated, not derivative** — leader election, locks, and replay event bus fill a real, currently-empty gap that `channel-state` and others don't touch.
- **Honest about scope** — "When NOT to use this" is a first-class section, setting expectations before users hit walls.
