# Serialization Contract

TabSync uses JSON serialization for all cross-tab state. This page documents what works, what doesn't, and why.

## What Works

```typescript
// Primitives
{ count: 0 }
{ name: 'hello' }
{ active: true }
{ ratio: 3.14 }

// Plain objects
{ user: { name: 'Alice', age: 30 } }

// Arrays
{ items: ['a', 'b', 'c'] }

// Nested objects
{ config: { theme: 'dark', locale: 'en' } }
```

## What Doesn't Work

```typescript
// Dates — stored as ISO strings, not revived
{ createdAt: new Date() }  // → "2026-01-15T10:30:00.000Z" (string after rehydration)

// Maps and Sets — not JSON-serializable
{ cache: new Map() }  // → {}
{ seen: new Set() }   // → {}

// Functions — stripped
{ onClick: () => {} }  // → {}

// BigInt — throws
{ id: 9007199254740993n }  // → TypeError

// RegExp — serialized as empty object
{ pattern: /test/ }  // → {}
```

## Why JSON

- **BroadcastChannel** uses `structuredClone` internally, which supports more types
- **localStorage** only supports strings, so JSON is the binding constraint
- JSON is the common denominator — if it survives `JSON.stringify`/`JSON.parse`, it works everywhere

## Workarounds

```typescript
// Dates: store as ISO string, parse on read
interface State {
  createdAt: string; // ISO string
}
const state = createSharedStore({
  name: 'events',
  initial: { createdAt: new Date().toISOString() },
});

// Maps: convert to arrays
interface State {
  cache: [string, value][];
}

// Sets: convert to arrays
interface State {
  seen: string[];
}
```

## Reserved Keys

The keys `_meta`, `$tabcoord`, and `$patch` are stripped from event bus payloads during transport. Your state data is **not** affected — these keys are preserved in store state.

```typescript
// State data is preserved as-is
cart.set({ items: [], _meta: 'user-data', $tabcoord: 'something' });
// Stored as: { items: [], _meta: 'user-data', $tabcoord: 'something' }
```
