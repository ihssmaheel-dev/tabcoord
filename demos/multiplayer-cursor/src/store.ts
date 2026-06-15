import { syncedList, type SyncedList } from '@tabcoord/list';

export interface CursorState {
  x: number;
  y: number;
  color: string;
  tabId: string;
}

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

export const cursors: SyncedList<CursorState> = syncedList<CursorState>('cursors');

export function getRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}
