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
  const idx = s.indexOf(':');
  return { counter: Number(s.slice(0, idx)), tabId: s.slice(idx + 1) };
}
