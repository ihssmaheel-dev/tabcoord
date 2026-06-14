import { getTabId } from './tab-id.js';
import type { Clock } from './clock.js';

const DEBUG_KEY = 'tabcoord=debug';

let _enabled = false;

if (typeof window !== 'undefined') {
  _enabled = window.location.search.includes(DEBUG_KEY);
}

export function isDebug(): boolean {
  return _enabled;
}

export function log(...args: unknown[]): void {
  if (!_enabled) return;
  console.log(`[tabcoord:${getTabId()}]`, ...args);
}

export function warn(...args: unknown[]): void {
  if (!_enabled) return;
  console.warn(`[tabcoord:${getTabId()}]`, ...args);
}

export function error(...args: unknown[]): void {
  if (!_enabled) return;
  console.error(`[tabcoord:${getTabId()}]`, ...args);
}

export interface TabCoordDebug {
  tabId: string;
  clock: Clock | null;
  status: string;
}

if (typeof window !== 'undefined' && _enabled) {
  (window as unknown as Record<string, unknown>)['__tabcoord'] = {
    tabId: getTabId(),
    stores: new Map<string, { clock: Clock | null; status: string }>(),
  };
}

export function updateDebugInfo(
  name: string,
  info: { clock: Clock | null; status: string },
): void {
  if (!_enabled || typeof window === 'undefined') return;
  const global = (window as unknown as Record<string, unknown>)['__tabcoord'] as {
    stores: Map<string, { clock: Clock | null; status: string }>;
  } | undefined;
  if (global) {
    global.stores.set(name, info);
  }
}
