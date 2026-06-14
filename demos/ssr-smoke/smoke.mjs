import { createSharedStore, eventBus, diff, apply } from '@tabcoord/core';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

console.log('SSR Smoke Test — @tabcoord/core\n');

// 1. createSharedStore in non-browser (SSR) environment
console.log('1. createSharedStore (SSR)');
const store = createSharedStore({
  name: 'ssr-cart',
  initial: { items: [] },
});
assert(store.get().items.length === 0, 'get() returns initial value');
assert(store.status === 'synced', 'status is synced in SSR');

// 2. set() updates state locally
console.log('\n2. set() updates state');
store.set({ items: [{ id: '1', name: 'Widget', price: 9.99 }] });
assert(store.get().items.length === 1, 'set() applies value');
assert(store.get().items[0].name === 'Widget', 'set() preserves data');

// 3. set() with updater function
console.log('\n3. set() with updater function');
store.set((prev) => ({
  items: [...prev.items, { id: '2', name: 'Gadget', price: 19.99 }],
}));
assert(store.get().items.length === 2, 'updater function merges correctly');

// 4. subscribe() works
console.log('\n4. subscribe()');
let notified = false;
const unsub = store.subscribe(() => { notified = true; });
store.set({ items: [] });
assert(notified === true, 'subscriber notified on change');
unsub();
notified = false;
store.set({ items: [{ id: '3', name: 'Test', price: 1 }] });
assert(notified === false, 'unsubscribed subscriber not notified');

// 5. destroy() works
console.log('\n5. destroy()');
store.destroy();
assert(store.status === 'synced', 'status still accessible after destroy');

// 6. eventBus creates and destroys without error
console.log('\n6. eventBus');
const bus = eventBus('ssr-events');
let handlerCalled = false;
bus.on('test:event', () => { handlerCalled = true; });
// In SSR, emit goes through noop transport — handler won't fire
// but the API should not throw
bus.emit('test:event', { data: 42 });
assert(handlerCalled === false, 'eventBus emit does not throw in SSR (noop transport)');
bus.on('user:*', () => {});
bus.destroy();
assert(true, 'eventBus destroy does not throw');

// 7. diff/apply works on plain objects
console.log('\n7. diff/apply');
const prev = { a: 1, b: 'hello', c: true };
const next = { a: 2, b: 'hello', c: false };
const patch = diff(prev, next);
assert(patch !== prev, 'diff returns new object when changes exist');
const applied = apply(prev, patch);
assert(applied.a === 2, 'apply merges changed key');
assert(applied.b === 'hello', 'apply preserves unchanged key');
assert(applied.c === false, 'apply merges all changed keys');

// 8. diff returns prev for identical objects
console.log('\n8. diff identity');
const same = diff(prev, prev);
assert(same === prev, 'diff returns same reference for identical objects');

// Summary
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
