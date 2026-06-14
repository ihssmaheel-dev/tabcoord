# Initial Resolution

When you call `createSharedStore`, the `initial` value goes through a resolution order to determine the starting state.

## Resolution Order

1. **Persisted state** — If `persist` is configured and localStorage has stored data, use it
2. **HMR cache** — If the module reloaded in dev, reuse the factory's previous result
3. **Factory evaluation** — Call `initial()` if it's a function, otherwise use the static value

```typescript
// Static initial — same reference on HMR reload
const store = createSharedStore({
  name: 'counter',
  initial: { count: 0 },
});

// Factory initial — fresh instance on cold start, cached on HMR
const store = createSharedStore({
  name: 'counter',
  initial: () => ({ count: 0, createdAt: Date.now() }),
});
```

## Static vs Factory

| | Static `T` | Factory `() => T` |
|---|---|---|
| Cold start | Uses the value | Calls the function |
| HMR reload | Reuses cached value | Reuses cached value |
| Rehydrate from storage | Uses stored value | Uses stored value |
| Module-scope export | Safe | Safe |

**Use static** when the initial value is a simple literal (numbers, strings, plain objects).

**Use factory** when you need a fresh instance each time (e.g., generating IDs, timestamps).

## Persistence Priority

When `persist` is configured, stored state always wins over the `initial` value:

```typescript
const store = createSharedStore({
  name: 'cart',
  initial: { items: [] },
  persist: { version: 1 },
});

// First visit: { items: [] } (from initial)
// After adding items and reloading: { items: [...] } (from localStorage)
```

## Version Bumps

When you change the shape of your state, bump the `persist.version` to invalidate old data:

```typescript
// v1: { items: string[] }
// v2: { items: { id: string, name: string }[] }
const store = createSharedStore({
  name: 'cart',
  initial: { items: [] },
  persist: { version: 2 },  // old v1 data is discarded
});
```
