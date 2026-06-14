# Lifecycle & destroy()

Every `createSharedStore` call creates resources that need cleanup. Call `destroy()` when the store is no longer needed.

## When to Call destroy()

- **SPA route changes** — the store is no longer relevant
- **Component unmount** (if using `createStoreContext` — it auto-destroys)
- **HMR cleanup** — dev server reloading

```typescript
const cart = createSharedStore({ name: 'cart', initial: { items: [] } });

// Later, when done:
cart.destroy();
```

## What destroy() Does

1. Closes the `BroadcastChannel` (stops receiving messages)
2. Clears all timers (bootstrap timeout, TTL expiry)
3. Destroys the `MessageBus` (unsubscribes from transport)
4. Clears all subscribers
5. Removes from the instance cache
6. Clears the factory cache (prevents stale state on re-create)

## After destroy()

```typescript
cart.destroy();

cart.get();     // returns last known state (no-op)
cart.set(x);    // logs a dev warning, no-op
cart.subscribe(() => {});  // returns no-op unsubscribe
cart.status;    // 'synced'
```

## Re-creating After destroy()

You can re-create a store with the same name. It starts fresh with a new bootstrap:

```typescript
cart.destroy();
const cart2 = createSharedStore({ name: 'cart', initial: { items: [] } });
// cart2 bootstraps from scratch — no stale state from the old instance
```

## Auto-Destroy with createStoreContext

If you use `createStoreContext`, the `Provider` component automatically calls `store.destroy()` on unmount:

```tsx
const { Provider, useStore } = createStoreContext({
  name: 'cart',
  initial: { items: [] },
});

function App() {
  return (
    <Provider>
      {/* store is destroyed when Provider unmounts */}
      <Cart />
    </Provider>
  );
}
```

## Memory Leaks

If you create stores in a loop without calling `destroy()`, each store leaks a `BroadcastChannel` and its subscriptions:

```typescript
// BAD — leaks BroadcastChannels
for (const doc of documents) {
  createSharedStore({ name: `doc-${doc.id}`, initial: doc });
}

// GOOD — clean up when done
for (const doc of documents) {
  const store = createSharedStore({ name: `doc-${doc.id}`, initial: doc });
  // use store...
  store.destroy();
}
```

## Destroy in Tests

Always destroy stores in test cleanup to avoid cross-test pollution:

```typescript
afterEach(() => {
  cart.destroy();
});
```
