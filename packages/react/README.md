# tabcoord-react

**React hooks for cross-tab state synchronization.**

[![npm version](https://img.shields.io/npm/v/tabcoord-react.svg)](https://www.npmjs.com/package/tabcoord-react)
[![license](https://img.shields.io/npm/l/tabcoord-react.svg)](https://www.npmjs.com/package/tabcoord-react)

```typescript
import { createSharedStore } from 'tabcoord';
import { useSharedStore } from 'tabcoord-react';

const cart = createSharedStore({ name: 'cart', initial: { items: [] } });

function Cart() {
  const items = useSharedStore(cart, s => s.items);
  return <button>Add ({items.length})</button>;
}
```

## Install

```bash
npm install tabcoord-react tabcoord
```

## Quick Start

```tsx
import { createSharedStore } from 'tabcoord';
import { useSharedStore } from 'tabcoord-react';

// 1. Create a shared store
const cart = createSharedStore({
  name: 'cart',
  initial: { items: [] },
});

// 2. Use it in your components
function Cart() {
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

Open two tabs. Add an item in Tab A. It appears in Tab B automatically.

## API

### `useSharedStore(store, selector)`

React hook for reading state from a shared store.

```typescript
const count = useSharedStore(store, s => s.count);
const items = useSharedStore(store, s => s.items);
const user = useSharedStore(store, s => s.user);
```

- **store**: A `SharedStoreHandle` created by `createSharedStore`
- **selector**: A function that extracts the value you need
- Returns the selected value, re-renders when it changes

### `useSharedEvent(bus, event, handler)`

React hook for listening to cross-tab events.

```typescript
import { eventBus } from 'tabcoord';
import { useSharedEvent } from 'tabcoord-react';

const bus = eventBus('my-events');

function Notifications() {
  useSharedEvent(bus, 'user:login', (event) => {
    console.log('User logged in:', event.payload);
  });
  
  return <div>Notifications</div>;
}
```

### `createStoreContext(options)`

Creates a React Context for dependency injection (testing, SSR).

```typescript
import { createStoreContext } from 'tabcoord-react';

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

## Requirements

- React 18 or 19
- `tabcoord` (peer dependency)

## Examples

### Shopping Cart

```tsx
import { createSharedStore } from 'tabcoord';
import { useSharedStore } from 'tabcoord-react';

const cart = createSharedStore({
  name: 'cart',
  initial: { items: [] },
  persist: { version: 1 },
});

function Cart() {
  const { items } = useSharedStore(cart, s => s);
  
  return (
    <div>
      <h2>Cart ({items.length})</h2>
      {items.map(item => (
        <div key={item.id}>{item.name} - ${item.price}</div>
      ))}
      <button onClick={() => cart.set(s => ({
        items: [...s.items, { id: Date.now(), name: 'New', price: 9.99 }]
      }))}>
        Add Item
      </button>
    </div>
  );
}
```

### Auth Sync

```tsx
import { createSharedStore } from 'tabcoord';
import { useSharedStore } from 'tabcoord-react';

const auth = createSharedStore({
  name: 'auth',
  initial: { user: null, isLoggedIn: false },
});

function Login() {
  const { isLoggedIn } = useSharedStore(auth, s => s);
  
  if (isLoggedIn) {
    return <button onClick={() => auth.set({ user: null, isLoggedIn: false })}>
      Logout
    </button>;
  }
  
  return <button onClick={() => auth.set({ user: { name: 'Alice' }, isLoggedIn: true })}>
    Login
  </button>;
}
```

## Requirements

- React 18 or 19
- `tabcoord` (peer dependency)

## License

MIT
