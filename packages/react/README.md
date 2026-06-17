# tabcoord-react

**Cross-tab state sync, leader election, locks, and event bus — one install, React hooks included.**

[![npm version](https://img.shields.io/npm/v/tabcoord-react.svg)](https://www.npmjs.com/package/tabcoord-react)

## Install

```bash
npm install tabcoord-react
```

That's it. `tabcoord` is a dependency — it installs automatically. Import everything from one package.

## Quick Start

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

Open two tabs. Add an item in Tab A — it appears in Tab B instantly.

## What You Can Import

All core APIs are re-exported from `tabcoord-react`:

```tsx
// React hooks
import { useSharedStore, useSharedEvent, createStoreContext } from 'tabcoord-react';

// Core APIs
import { createSharedStore, eventBus, leaderElection, lockManager } from 'tabcoord-react';

// Types
import type { SharedStoreHandle, EventBus, Clock } from 'tabcoord-react';
```

## React Hooks

### `useSharedStore(store, selector)`

Reads state from a store and re-renders when the selected value changes.

```tsx
const count = useSharedStore(store, s => s.count);
const total = useSharedStore(store, s => s.items.reduce((sum, i) => sum + i.price, 0));
```

- **store** — a `SharedStoreHandle` from `createSharedStore()`
- **selector** — function that extracts the value you need
- Returns the selected value. Re-renders only when it changes (shallow comparison).

### `useSharedEvent(bus, event, handler)`

Listens to cross-tab events.

```tsx
import { eventBus } from 'tabcoord-react';
import { useSharedEvent } from 'tabcoord-react';

const bus = eventBus('notifications');

function Toast() {
  useSharedEvent(bus, 'user:login', (e) => {
    showToast(`User ${e.payload.userId} logged in`);
  });
  return <div>Toast container</div>;
}
```

- **bus** — an `EventBus` from `eventBus()`
- **event** — event type string (supports `*` wildcard)
- **handler** — always the latest reference, no unnecessary re-subscriptions

### `createStoreContext(options)`

Creates a React Context for dependency injection (testing, SSR, multi-provider).

```tsx
import { createStoreContext, useSharedStore } from 'tabcoord-react';

const { Provider, useStore } = createStoreContext({
  name: 'cart',
  initial: { items: [] },
});

function App() {
  return (
    <Provider>
      <Cart />
    </Provider>
  );
}

function Cart() {
  const store = useStore();
  const items = useSharedStore(store, s => s.items);
  return <div>{items.length} items</div>;
}
```

- `Provider` — wraps children, lazily creates store on first mount, destroys on unmount
- `useStore()` — returns the store handle (must be inside `Provider`)
- Throws if `useStore()` is used outside a `Provider`

## Full Example

```tsx
import {
  createSharedStore,
  eventBus,
  useSharedStore,
  useSharedEvent,
} from 'tabcoord-react';

const cart = createSharedStore({
  name: 'cart',
  initial: { items: [] },
  persist: { version: 1 },
});

const bus = eventBus('cart-events');

function Cart() {
  const items = useSharedStore(cart, s => s.items);
  const total = useSharedStore(cart, s => s.items.reduce((sum, i) => sum + i.price, 0));

  useSharedEvent(bus, 'item:added', (e) => {
    console.log('Added:', e.payload);
  });

  return (
    <div>
      <h2>Cart ({items.length} items)</h2>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item.name} — ${item.price}</li>
        ))}
      </ul>
      <p>Total: ${total}</p>
      <button onClick={() => {
        cart.set(s => ({ items: [...s.items, { name: 'Widget', price: 9.99 }] }));
        bus.emit('item:added', { name: 'Widget' });
      }}>
        Add Widget
      </button>
    </div>
  );
}
```

## Requirements

- React 18 or 19
- `tabcoord` is installed automatically (no manual install needed)

## License

MIT
