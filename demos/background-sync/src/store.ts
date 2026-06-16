import { createSharedStore, leaderElection } from '@tabcoord/core';

export interface SyncState {
  lastFetch: string | null;
  data: string[];
  fetchCount: number;
}

export const syncStore = createSharedStore<SyncState>({
  name: 'background-sync',
  initial: { lastFetch: null, data: [], fetchCount: 0 },
});

export const election = leaderElection('bg-sync', {
  heartbeatInterval: 1000,
  timeout: 3000,
});

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startPolling(): void {
  if (pollTimer) return;

  election.onElected(() => {
    console.log('This tab is now the leader â€” starting poll');
    pollTimer = setInterval(() => {
      // Mock API call
      const now = new Date().toLocaleTimeString();
      syncStore.set((prev) => ({
        lastFetch: now,
        data: [...prev.data.slice(-9), `Update ${prev.fetchCount + 1} at ${now}`],
        fetchCount: prev.fetchCount + 1,
      }));
    }, 3000);
  });

  election.onDemoted(() => {
    console.log('This tab lost leadership â€” stopping poll');
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  // Don't destroy election here â€” it's module-scope and should persist
}
