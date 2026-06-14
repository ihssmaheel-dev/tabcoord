# Browser Tab Sync Framework — Master Plan (Final, v8)

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
  core/       @tabcoord/core      — <3kb gz, zero deps (CI-enforced)
  react/      @tabcoord/react     — useSharedStore, useSharedEvent, useLock, useLeader
  vue/        @tabcoord/vue       — composables, same surface as react
  schema/     @tabcoord/schema    — optional Zod integration (peer dep)
  list/       @tabcoord/list      — syncedList() OR-Set CRDT
  devtools/   @tabcoord/devtools  — debug overlay + time-travel (OSS)
```

`@tabcoord/core` alone is a complete, useful library.

---

## Implementation Decision: SSR Instance Swap

The `_instanceCache` swap (SSR no-op → real client instance) is implemented as a **wrapper class forwarding every method**, not a `Proxy`. Explicit, debuggable, no `this`-binding surprises with method extraction (`const { set } = cart`), tree-shakes cleanly.

```typescript
class SharedStoreHandle<T> {
  constructor(private name: string) {}
  get(): T { return _instanceCache.get(this.name)!.get(); }
  set(v: T | ((s: T) => T)): void { _instanceCache.get(this.name)!.set(v); }
  subscribe(fn: (s: T) => void): () => void { return _instanceCache.get(this.name)!.subscribe(fn); }
  destroy(): void { _instanceCache.get(this.name)!.destroy(); _instanceCache.delete(this.name); }
  get status(): 'bootstrap' | 'synced' { return _instanceCache.get(this.name)!._status; }
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
| `state-patch` | any → all | Normal write broadcast (diff) |
| `heartbeat` | leader candidates → all | `{ tabId, ts }` |
| `lock-request` / `lock-grant` / `lock-release` | lock participants | FIFO mutex protocol |

**Chunking:** chunks shaped `{ _meta: { id, chunkIndex, totalChunks }, payload }`. Receiver buffer: `{ chunks: Map<number, string>, resolved: boolean, timeoutHandle }`. Final chunk or 2s timeout — whichever fires first sets `resolved = true` and acts; the other is a no-op. 64KB threshold leaves margin under Safari's ~256KB BroadcastChannel limit.

**Join sequence:**
1. Generate per-session `tabId` (`crypto.randomUUID()` + fallback for old Safari)
2. Jitter 50–200ms
3. Broadcast `sync-request`
4. Queue writes during hold period (not applied)
5. On `sync-response` (within 500ms): apply received state `S`, then **replay queued writes on top of `S`, in order** — never reversed
6. Broadcast `sync-ack`
7. On timeout: fresh-init from resolved `initial`, flush queue on top

This closes the critical bug where a late-joining tab's empty initial state could LWW-overwrite an existing tab's data.

---

## SSR / Non-Browser Environments

**Detection:**
```typescript
const isBrowser = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined';
```

**Server:** `createSharedStore` registers a no-op instance in `_instanceCache` — `get()` returns resolved `initial`, `set()` is in-memory only, `subscribe()` never fires, `status` is always `'synced'`.

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
  // 1. Persisted state from a real previous session — source of truth
  if (persistConfig) {
    const stored = readFromStorage(name, persistConfig);
    if (stored !== undefined) return stored;
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
// store.rehydrate() — manual re-read from storage
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
| Sync chunk reassembly timeout | `resolved` flag prevents race; discard, fresh-init |
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
- Replay ring buffer (default N=20, configurable) backed by `syncStorage` — no leader dependency, no single point of failure. Tradeoff: a tab asleep through 21+ events permanently misses overflow (documented).

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
- Acceleration: `navigator.locks` race when available — instant leadership, heartbeat becomes liveness-only. Correct with or without Web Locks.
- `pagehide`/`visibilitychange` → immediate step-down broadcast; heartbeat timeout is the guaranteed fallback for crashes/freezes/Safari background-kills.
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
- TTL auto-release (default 30s) — covers frozen/crashed holder.
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

**Built into core:** `?tabcoord=debug` structured console logs (`[tabcoord:<tabId>] msg data`), `window.__tabcoord` global exposing clock/peers/leader/lock state, visual debug badge, `store.inspect()`.

**`@tabcoord/devtools` (Phase 3):** browser extension — tab map, leader indicator, lock queue viz, time-travel debugger.

---

## Phased Roadmap

### Phase 1 — Foundation + Correctness (Weeks 1–4) → `v0.1.0`

- [ ] `@tabcoord/core`: BroadcastChannel transport + localStorage/storage-event fallback + SSR no-op
- [ ] Logical clock, per-session `tabId` (`crypto.randomUUID()` + fallback), lexicographic tiebreak
- [ ] Bootstrap protocol: sync-request/response/ack, jitter, sync-then-replay write queue
- [ ] Chunking: sequence-numbered chunks, `resolved`-flag race prevention, 2s reassembly timeout
- [ ] `createSharedStore`:
  - [ ] `'whole'` merge
  - [ ] `set(value)` and `set(fn)`
  - [ ] `initial: T | (() => T)`, resolution order: storage → HMR cache → factory
  - [ ] `status: 'bootstrap' | 'synced'`
  - [ ] versioned persistence (`tabcoord:v1:<name>:state`), `onRehydrate`, `onError`
  - [ ] `destroy()` + `_instanceCache` + **`SharedStoreHandle` wrapper class** for SSR swap
- [ ] `syncStorage`, `eventBus` (wildcards, `_meta`, `unsubscribe`, replay, `destroy()`)
- [ ] `@tabcoord/react`: `useSharedStore` (handles SSR→client swap via handle, exposes `status`), `useSharedEvent`
- [ ] `createStoreContext()` helper
- [ ] CI: `size-limit` (<3kb gz, zero deps) from commit one
- [ ] Docs: serialization contract, static-vs-factory `initial`, Safari private-browsing fallback, SSR singleton pattern (prominent), `destroy()` for SPA routing
- [ ] **Demo 0:** Next.js SSR — module-scope store, no throw, correct hydration
- [ ] **Demo 1:** Shared shopping cart — late-join test, `status: 'bootstrap'` UI
- [ ] **Demo 2:** Auth sync (logout propagates)
- [ ] Playwright multi-context harness

**Exit criteria:** Demos 1/2 pass in Chrome/Firefox/Safari 16+. Passing tests for: late-join (no state wipe), corrupted-storage fallback, BroadcastChannel-unavailable fallback, Safari-private-mode `SecurityError`, chunking race (>64KB + timeout-adjacent final chunk), SSR smoke test, `destroy()` (channel closed, `set()` no-ops with warning). Bundle <3kb gz enforced.

---

### Phase 2 — Coordination Primitives (Weeks 5–7) → `v0.5.0`

- [ ] `leaderElection` — heartbeat (configurable, Safari preset), Web Locks acceleration, pagehide step-down, per-session `tabId`, `destroy()`
- [ ] `lockManager` — FIFO, TTL auto-release, per-tab reentrancy counter, `destroy()`
- [ ] `mergeStrategy: 'field'` — shallow one-level, documented atomicity
- [ ] `@tabcoord/schema` — Zod integration
- [ ] `@tabcoord/vue` — composables mirroring React API
- [ ] **Demo 3:** Background sync (leader-only polling)
- [ ] **Demo 4:** Distributed form (field-level merge)
- [ ] Playwright: leader-kill failover (<5s, <15s Safari), lock-crash TTL recovery, reentrant acquire/release, destroy-during-active-lock

**Exit criteria:** All 4 demos pass. Failover, TTL recovery, reentrancy, and destroy are automated tests.

---

### Phase 3 — Polish, Scale & Differentiation (Weeks 8–10) → `v1.0.0`

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

0. **SSR Smoke Test** (P1) — module-scope store, no throw, correct hydration
1. **Shared Shopping Cart** (P1) — late-join correctness, `status` UI
2. **Auth Sync** (P1) — logout everywhere
3. **Background Sync** (P2) — leaderElection showcase
4. **Distributed Form** (P2) — field-merge showcase
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

## Immediate Next Steps (Day-by-Day)

1. **Day 1–2:** Spike — BroadcastChannel ordering/delivery (Chrome/Firefox/Safari) **and** prototype the bootstrap handshake (riskiest, highest-priority new scope).
2. **Day 3:** Repo scaffold — `pnpm`/`turborepo`, `@tabcoord/core` skeleton, CI with `size-limit` + Playwright multi-context configured. Implement `SharedStoreHandle` wrapper class skeleton early — it's the spine of the SSR story.
3. **Day 4–7:** Logical clock + bootstrap protocol + `'whole'` merge + `createSharedStore` (with correct `initial` resolution order from the start). Late-join cart test as primary correctness harness.
4. **Week 2:** `syncStorage` (versioned, corrupted-data fallback) + `eventBus` (`_meta`, `unsubscribe`, replay). Write README around the 5-line cart example. Add `destroy()` to all Phase 1 primitives before moving on — retrofitting lifecycle cleanup later is painful.
5. **Week 2 (parallel):** Publish RFC for wire protocol message types + public API (`mergeStrategy`, `persist`, `onError`, `status`, `destroy`) — this is the contract `v0.1.0` locks in.
6. **Week 3:** `leaderElection` heartbeat skeleton with Safari-preset config from the start.

---

## North Star Metric

*"Time from `npm i` to working shared state in 2 tabs"* → **under 60 seconds** — including the case where Tab B opens after Tab A already has state, and Tab A's data is never wiped.

---

## What Makes This Work Really Well

- **The #1 silent-data-loss bug (late-join LWW wipe) is fixed before `v0.1.0`**, with apply-order explicitly specified.
- **Every "what about X?" question — serialization, persistence versioning, merge depth, clock ties, chunking races, HMR, SSR identity, lifecycle leaks — has a documented, concrete answer**, not a hand-wave.
- **Correctness has automated tests from day one**: late-join, leader-kill, lock-crash, corrupted-storage, BroadcastChannel-unavailable, SSR swap, chunking race, `destroy()`.
- **Wire protocol, storage format, `initial` contract, and lifecycle are all locked correctly at `v0.1.0`** — no anticipated breaking changes through `v1.0.0`.
- **Differentiated, not derivative** — leader election, locks, and replay event bus fill a real, currently-empty gap that `channel-state` and others don't touch.
- **Honest about scope** — "When NOT to use this" is a first-class section, setting expectations before users hit walls.