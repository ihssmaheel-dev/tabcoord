import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function createMockTransport() {
  const handlers = new Set<(data: unknown) => void>();
  return {
    onMessage: vi.fn((handler: (data: unknown) => void) => {
      handlers.add(handler);
      return () => { handlers.delete(handler); };
    }),
    send: vi.fn((data: unknown) => {
      // Deliver to all handlers (simulating same-tab echo)
      for (const h of handlers) h(data);
    }),
    destroy: vi.fn(),
    isAvailable: vi.fn(() => true),
    _handlers: handlers,
  };
}

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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('single tab becomes leader after timeout', async () => {
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

    // After destroy, advancing timers should not fire callbacks
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
});
