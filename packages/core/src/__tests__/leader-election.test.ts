import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function createMockEnv() {
  const docListeners = new Map<string, Set<EventListener>>();
  const winListeners = new Map<string, Set<EventListener>>();

  const mockDocument = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (type: string, handler: EventListener) => {
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type)!.add(handler);
    },
    removeEventListener: (type: string, handler: EventListener) => {
      docListeners.get(type)?.delete(handler);
    },
    dispatchEvent: (event: Event) => {
      docListeners.get(event.type)?.forEach((h) => h(event));
    },
  };

  const mockWindow = {
    addEventListener: (type: string, handler: EventListener) => {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type)!.add(handler);
    },
    removeEventListener: (type: string, handler: EventListener) => {
      winListeners.get(type)?.delete(handler);
    },
  };

  return { mockDocument, mockWindow, docListeners, winListeners };
}

describe('leaderElection', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    vi.useFakeTimers();
    // Stub navigator without locks to test heartbeat path
    vi.stubGlobal('navigator', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('single tab becomes leader after timeout (heartbeat path)', async () => {
    const { mockDocument, mockWindow } = createMockEnv();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', mockWindow);
    const { leaderElection } = await import('../leader-election.js');

    const election = leaderElection('test', { timeout: 100 });
    expect(election.isLeader).toBe(false);

    vi.advanceTimersByTime(150);
    expect(election.isLeader).toBe(true);

    election.destroy();
  });

  it('onElected callback fires when becoming leader', async () => {
    const { mockDocument, mockWindow } = createMockEnv();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', mockWindow);
    const { leaderElection } = await import('../leader-election.js');

    const election = leaderElection('test-cb', { timeout: 100 });
    const elected = vi.fn();
    election.onElected(elected);

    vi.advanceTimersByTime(150);
    expect(elected).toHaveBeenCalledTimes(1);

    election.destroy();
  });

  it('onDemoted callback fires when losing leadership', async () => {
    const { mockDocument, mockWindow } = createMockEnv();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', mockWindow);
    const { leaderElection } = await import('../leader-election.js');

    const election = leaderElection('test-demote', { timeout: 50 });
    const demoted = vi.fn();
    election.onDemoted(demoted);

    vi.advanceTimersByTime(100);
    expect(election.isLeader).toBe(true);

    // Simulate visibility change to hidden
    mockDocument.visibilityState = 'hidden';
    mockDocument.dispatchEvent(new Event('visibilitychange'));

    expect(election.isLeader).toBe(false);
    expect(demoted).toHaveBeenCalledTimes(1);

    election.destroy();
  });

  it('destroy stops heartbeat and clears state', async () => {
    const { mockDocument, mockWindow } = createMockEnv();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', mockWindow);
    const { leaderElection } = await import('../leader-election.js');

    const election = leaderElection('test-destroy', { heartbeatInterval: 100 });
    vi.advanceTimersByTime(250);

    const elected = vi.fn();
    election.onElected(elected);
    election.destroy();

    vi.advanceTimersByTime(1000);
    expect(elected).not.toHaveBeenCalled();
  });

  it('unsubscribed callbacks are not called', async () => {
    const { mockDocument, mockWindow } = createMockEnv();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', mockWindow);
    const { leaderElection } = await import('../leader-election.js');

    const election = leaderElection('test-unsub', { timeout: 50 });
    const elected = vi.fn();
    const unsub = election.onElected(elected);

    unsub();
    vi.advanceTimersByTime(100);

    expect(elected).not.toHaveBeenCalled();
    election.destroy();
  });

  it('Web Locks: becomes leader instantly when lock acquired', async () => {
    const { mockDocument, mockWindow } = createMockEnv();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', mockWindow);

    // Mock navigator.locks — lock is acquired immediately
    vi.stubGlobal('navigator', {
      locks: {
        request: vi.fn((_name: string, _opts: unknown, fn: () => Promise<void>) => {
          return fn();
        }),
      },
    });

    const { leaderElection } = await import('../leader-election.js');

    const elected = vi.fn();
    // Register callback BEFORE creating election so we don't miss the event
    const election = leaderElection('test-weblocks');
    election.onElected(elected);

    // Web Locks path is async — need to flush microtasks
    await vi.advanceTimersByTimeAsync(10);

    // isLeader should be true from the Web Locks path
    expect(election.isLeader).toBe(true);

    election.destroy();
  });

  it('Web Locks: falls back to heartbeat when navigator.locks unavailable', async () => {
    const { mockDocument, mockWindow } = createMockEnv();
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', mockWindow);
    // navigator.locks is undefined
    vi.stubGlobal('navigator', {});

    const { leaderElection } = await import('../leader-election.js');

    const election = leaderElection('test-fallback', { timeout: 100 });
    expect(election.isLeader).toBe(false);

    vi.advanceTimersByTime(150);
    expect(election.isLeader).toBe(true);

    election.destroy();
  });
});
