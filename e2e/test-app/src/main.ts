import { createSharedStore, eventBus, getTabId } from '@tabcoord/core';

// Expose test API on window
const store = createSharedStore<{ count: number; str: string }>({
  name: 'e2e-test',
  initial: { count: 0, str: '' },
});

const bus = eventBus('e2e-bus');

(window as unknown as Record<string, unknown>).__tabcoord_test = {
  getTabId,
  store,
  bus,
};

// UI updates
const tabIdEl = document.getElementById('tabId')!;
const storeValueEl = document.getElementById('storeValue')!;
const storeStatusEl = document.getElementById('storeStatus')!;
const subscribeCountEl = document.getElementById('subscribeCount')!;
const eventCountEl = document.getElementById('eventCount')!;
const eventsEl = document.getElementById('events')!;
const statusEl = document.getElementById('status')!;

tabIdEl.textContent = getTabId();

function render() {
  const s = store.get();
  storeValueEl.textContent = JSON.stringify(s);
  storeStatusEl.textContent = store.status;
}

let subCount = 0;
store.subscribe(() => {
  subCount++;
  subscribeCountEl.textContent = String(subCount);
  render();
});

let eventCount = 0;
bus.on('*', (e) => {
  eventCount++;
  eventCountEl.textContent = String(eventCount);
  const li = document.createElement('li');
  li.textContent = `${e.type}: ${JSON.stringify(e.payload)} (source: ${e._meta.source})`;
  eventsEl.prepend(li);
});

// Initial render
render();
statusEl.textContent = 'ready';

// Button handlers
document.getElementById('incrementBtn')!.addEventListener('click', () => {
  store.set((prev) => ({ ...prev, count: prev.count + 1 }));
});

document.getElementById('setStrBtn')!.addEventListener('click', () => {
  store.set({ count: store.get().count, str: 'hello' });
});

document.getElementById('emitEventBtn')!.addEventListener('click', () => {
  bus.emit('test:click', { time: Date.now() });
});
