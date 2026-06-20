// @ts-check
// SSR smoke test — verifies tabcoord works in a Node.js environment (no DOM/no BroadcastChannel)

import { createSharedStore, getTabId, isPatch, apply, eventBus } from './dist/index.js';
import { diff } from './dist/diff-standalone.js';

// 1. tabId works without DOM
const tabId = getTabId();
console.assert(typeof tabId === 'string' && tabId.length > 0, 'tabId should be a non-empty string');
console.log('✓ tabId:', tabId);

// 2. createSharedStore works in SSR (auto-selects noop transport)
const store = createSharedStore({ name: 'ssr-store', initial: { count: 0 } });
console.assert(store.get().count === 0, 'initial state should be { count: 0 }');
console.assert(store.status === 'synced', 'SSR store should be synced immediately');
console.log('✓ SSR store created, status:', store.status);

store.set({ count: 1 });
console.assert(store.get().count === 1, 'state should be { count: 1 }');
console.log('✓ SSR store set/get works');

store.set((prev) => ({ count: prev.count + 1 }));
console.assert(store.get().count === 2, 'setter function should work');
console.log('✓ SSR store setter function works');

// 3. subscribe is noop in SSR (no re-rendering)
const unsub = store.subscribe(() => { throw new Error('should not be called in SSR'); });
console.assert(typeof unsub === 'function', 'subscribe should return a cleanup function');
console.log('✓ SSR store subscribe returns cleanup function (noop)');

// 4. Store still works after subscribe call
store.set({ count: 3 });
console.assert(store.get().count === 3, 'state update should work');
console.log('✓ SSR store still works after subscribe');

// 5. diff/apply/isPatch work in SSR
const patch = diff({ a: 1, b: 2 }, { a: 1, b: 3 });
console.assert(isPatch(patch), 'should be a patch');
console.assert(patch.b === 3, 'patch should contain changed fields');
const result = apply({ a: 1, b: 2, c: 3 }, patch);
console.assert(result.b === 3, 'apply should merge patch');
console.log('✓ diff/apply/isPatch work');

// 6. eventBus works in SSR (noop transport, local handlers fire)
const bus = eventBus('ssr-bus');
let eventReceived = false;
bus.on('test', () => { eventReceived = true; });
bus.emit('test', { data: 1 });
console.assert(eventReceived === true, 'local event handler should fire');
console.log('✓ SSR eventBus works (noop, local handler fires)');
bus.destroy();

// 7. Destroy idempotent
store.destroy();
console.log('✓ SSR store destroy works');

console.log('\nAll SSR smoke tests passed.');
