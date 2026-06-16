# tabcoord-react

**React hooks for cross-tab state synchronization.**

[![npm version](https://img.shields.io/npm/v/tabcoord-react.svg)](https://www.npmjs.com/package/tabcoord-react)

## Install

```bash
npm install tabcoord-react tabcoord
```

Requires React 18 or 19.

## Quick Start

```tsx
import { createSharedStore } from 'tabcoord';
import { useSharedStore } from 'tabcoord-react';

// Create a shared store (once, outside components)
const cart = createSharedStore({
  name: 'cart',
  initial: { items: [] },
});

// Use in any component
function Cart() {
  const items = useSharedStore(cart, s => s.items);

  return (
    <button onClick={() => cart.set(s => ({ items: [...s.items, 'Widget'] }))}>
      Add Widget ({items.length})
    </button>
  );
}
```

Open two tabs. Add an item in Tab A — it appears in Tab B automatically.

## API

### `useSharedStore(store, selector)`

React hook that reads state from a `SharedStoreHandle` and re-renders when the selected value changes.

```tsx
// Select the whole state
const state = useSharedStore(cart, s => s);

// Select a specific field
const count = useSharedStore(cart, s => s.count);

// Select derived data
const totalPrice = useSharedStore(cart, s => s.items.reduce((sum, i) => sum + i.price, 0));
```

**Parameters:**
- `store` — a `SharedStoreHandle` created by `createSharedStore`
- `selector` — function that extracts the value you need

**Returns:** The selected value (type-safe). Re-renders only when the selected value changes (shallow comparison).

### `useSharedEvent(bus, event, handler)`

React hook that listens to cross-tab events.

```tsx
import { eventBus } from 'tabcoord';
import { useSharedEvent } from 'tabcoord-react';

const bus = eventBus('notifications');

function Toast() {
  useSharedEvent(bus, 'user:login', (event) => {
    showToast(`User ${event.payload.userId} logged in`);
  });

  return <div>Toast container</div>;
}
```

**Parameters:**
- `bus` — an `EventBus` created by `eventBus()`
- `event` — event type string (supports `*` wildcard)
- `handler` — callback function

The handler is always the latest reference — no unnecessary re-subscriptions.

### `createStoreContext(options)`

Creates a React Context for dependency injection (testing, SSR, multi-provider patterns).

```tsx
import { createStoreContext } from 'tabcoord-react';

const { Provider, useStore } = createStoreContext({
  name: 'cart',
  initial: { items: [] },
});

// Wrap your app with Provider
function App() {
  return (
    <Provider>
      <Cart />
    </Provider>
  );
}

// Use the store in child components
function Cart() {
  const store = useStore();
  const items = useSharedStore(store, s => s.items);
  return <div>{items.length} items</div>;
}
```

**Returns:**
- `Provider` — wraps children, lazily creates the store on first mount, destroys on unmount
- `useStore()` — returns the `SharedStoreHandle` (must be used inside `Provider`)
- `store` — getter that returns the store handle

Using `useStore()` outside a `Provider` throws an error.

## Full Example

```tsx
import { createSharedStore } from 'tabcoord';
import { useSharedStore, useSharedEvent } from 'tabcoord-react';
import { eventBus } from 'tabcoord';

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

## TypeScript

Full type inference — no manual type annotations needed:

```tsx
interface CartState {
  items: Array<{ name: string; price: number }>;
}

const cart = createSharedStore<CartState>({
  name: 'cart',
  initial: { items: [] },
});

// Automatically typed
const items = useSharedStore(cart, s => s.items); // Array<{ name: string; price: number }>
```

## License

MIT
