# Browser Fallbacks

TabSync automatically falls back to the best available transport for cross-tab communication.

## Transport Selection

```
BroadcastChannel (preferred)
  ↓ if unavailable
localStorage + storage event
  ↓ if unavailable
In-memory noop (SSR/non-browser)
```

## BroadcastChannel

The default and preferred transport. Available in:
- Chrome 54+
- Firefox 38+
- Safari 15.4+ (but see below)

## localStorage Fallback

When `BroadcastChannel` is unavailable (e.g., Safari private browsing), TabSync falls back to writing JSON to `localStorage` and listening for `storage` events.

### Safari Private Browsing

Safari private browsing blocks `localStorage` writes with a `SecurityError`. TabSync detects this during initialization and falls back to an in-memory `Map`:

```typescript
// You can handle this in onError:
const store = createSharedStore({
  name: 'cart',
  initial: { items: [] },
  onError: (err) => {
    if (err.name === 'SecurityError') {
      console.warn('Running in private browsing — state won\'t persist');
    }
  },
});
```

## In-Memory Fallback

When both `BroadcastChannel` and `localStorage` are unavailable (SSR, non-browser), TabSync uses a no-op transport:
- `send()` does nothing
- `onMessage()` never fires
- State updates are local only (no cross-tab sync)

This is the correct behavior for server-side rendering.

## Storage Errors

| Error | Cause | Behavior |
|-------|-------|----------|
| `QuotaExceededError` | localStorage full | Falls back to in-memory |
| `SecurityError` | Safari private browsing | Falls back to in-memory |
| Corrupted JSON | Data tampered/corrupted | Clears entry, falls back to `initial` |

All storage errors are silently handled. Use `onError` to observe them:

```typescript
const store = createSharedStore({
  name: 'cart',
  initial: { items: [] },
  onError: (err) => console.error('TabSync error:', err),
});
```
