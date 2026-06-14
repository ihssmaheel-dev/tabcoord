import { createTransport, destroyTransport } from './transport/resolver.js';
import { getTabId } from './tab-id.js';
import { stripReservedKeys } from './message-bus.js';

export interface BusEvent {
  type: string;
  payload: unknown;
  _meta: {
    id: string;
    type: string;
    source: string;
    timestamp: number;
  };
}

export type EventHandler = (event: BusEvent) => void;

interface HandlerEntry {
  pattern: string;
  handler: EventHandler;
  isWildcard: boolean;
  regex: RegExp | null;
}

let _eventId = 0;

function nextId(): string {
  return `${getTabId()}:${++_eventId}`;
}

function patternToRegex(pattern: string): { regex: RegExp | null; isWildcard: boolean } {
  if (pattern.includes('*')) {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return { regex: new RegExp(`^${escaped}$`), isWildcard: true };
  }
  return { regex: null, isWildcard: false };
}

export interface EventBus {
  on(pattern: string, handler: EventHandler, options?: { replay?: boolean }): () => void;
  emit(type: string, payload?: unknown): void;
  destroy(): void;
}

export function eventBus(name: string): EventBus {
  const transport = createTransport(name);
  const handlers: HandlerEntry[] = [];
  const replayBuffer: BusEvent[] = [];
  const MAX_REPLAY = 20;

  function handleIncoming(event: BusEvent): void {
    if (!event._meta || event._meta.source === getTabId()) return;
    replayBuffer.push(event);
    if (replayBuffer.length > MAX_REPLAY) replayBuffer.shift();

    for (const entry of handlers) {
      if (entry.isWildcard && entry.regex?.test(event.type)) {
        entry.handler(event);
      } else if (!entry.isWildcard && entry.pattern === event.type) {
        entry.handler(event);
      }
    }
  }

  const unsub = transport.onMessage((data) => {
    handleIncoming(data as BusEvent);
  });

  return {
    on(pattern: string, handler: EventHandler, options?: { replay?: boolean }): () => void {
      const { regex, isWildcard } = patternToRegex(pattern);
      const entry: HandlerEntry = { pattern, handler, isWildcard, regex };
      handlers.push(entry);

      // Replay past events from buffer
      if (options?.replay) {
        for (const event of replayBuffer) {
          if (isWildcard && regex?.test(event.type)) {
            handler(event);
          } else if (!isWildcard && pattern === event.type) {
            handler(event);
          }
        }
      }

      return () => {
        const idx = handlers.indexOf(entry);
        if (idx !== -1) handlers.splice(idx, 1);
      };
    },

    emit(type: string, payload?: unknown): void {
      const cleanPayload = payload && typeof payload === 'object'
        ? stripReservedKeys(payload as Record<string, unknown>)
        : payload;

      const event: BusEvent = {
        type,
        payload: cleanPayload,
        _meta: {
          id: nextId(),
          type,
          source: getTabId(),
          timestamp: Date.now(),
        },
      };

      replayBuffer.push(event);
      if (replayBuffer.length > MAX_REPLAY) replayBuffer.shift();

      transport.send(event);
    },

    destroy(): void {
      unsub();
      handlers.length = 0;
      replayBuffer.length = 0;
      destroyTransport(name);
    },
  };
}
