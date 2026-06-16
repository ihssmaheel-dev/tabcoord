import { getTabId } from './tab-id.js';

export interface Clock {
  counter: number;
  tabId: string;
}

let _counter = 0;

export function tick(): Clock {
  return { counter: ++_counter, tabId: getTabId() };
}

export function resetCounter(): void {
  _counter = 0;
}

export function compare(a: Clock, b: Clock): number {
  const diff = a.counter - b.counter;
  if (diff !== 0) return diff;
  return a.tabId < b.tabId ? -1 : a.tabId > b.tabId ? 1 : 0;
}

export function serialize(clock: Clock): string {
  return `${clock.counter}:${clock.tabId}`;
}

export function deserialize(s: string): Clock {
  if (!s || typeof s !== 'string') return { counter: 0, tabId: getTabId() };
  const idx = s.indexOf(':');
  if (idx === -1) return { counter: 0, tabId: s || getTabId() };
  const counterPart = s.slice(0, idx);
  const tabId = s.slice(idx + 1);
  if (!tabId) return { counter: 0, tabId: getTabId() };
  const counter = Number(counterPart);
  return { counter: Number.isNaN(counter) || counter < 0 ? 0 : counter, tabId };
}
