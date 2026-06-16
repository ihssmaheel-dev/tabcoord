import type { Transport } from './transport/types.js';
import { getTabId } from './tab-id.js';
import type { Clock } from './clock.js';

export type MessageType =
  | 'sync-request'
  | 'sync-response'
  | 'state-snapshot'
  | 'state-patch'
  | 'sync-ack'
  | 'heartbeat'
  | 'lock-request'
  | 'lock-grant'
  | 'lock-release';

export interface MessageMeta {
  id: string;
  type: MessageType;
  source: string;
  timestamp: number;
  sequence: number;
  clock?: string;
}

export interface WireMessage {
  _meta: MessageMeta;
  payload?: unknown;
}

export type MessageHandler = (msg: WireMessage) => void;

let _msgId = 0;
let _sequence = 0;

function generateId(): string {
  return `${getTabId()}:${++_msgId}`;
}

export function resetMsgId(): void {
  _msgId = 0;
  _sequence = 0;
}

/*@__PURE__*/ export function stripReservedKeys<T extends Record<string, unknown>>(payload: T): T {
  const result = { ...payload };
  delete result['_meta'];
  delete result['$tabcoord'];
  delete result['$patch'];
  return result;
}

export function createMessage(
  type: MessageType,
  payload?: unknown,
  clock?: Clock,
): WireMessage {
  return {
    _meta: {
      id: generateId(),
      type,
      source: getTabId(),
      timestamp: Date.now(),
      sequence: ++_sequence,
      clock: clock ? `${clock.counter}:${clock.tabId}` : undefined,
    },
    payload,
  };
}

export class MessageBus {
  private handlers = new Map<string, Set<MessageHandler>>();
  private unsub: () => void;

  constructor(private transport: Transport) {
    this.unsub = transport.onMessage((data) => {
      const msg = data as WireMessage;
      if (!msg._meta?.type) return;
      const typeHandlers = this.handlers.get(msg._meta.type);
      if (typeHandlers) {
        for (const h of typeHandlers) h(msg);
      }
    });
  }

  on(type: MessageType, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => { this.handlers.get(type)?.delete(handler); };
  }

  off(type: MessageType, handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  emit(type: MessageType, payload?: unknown, clock?: Clock): void {
    const msg = createMessage(type, payload, clock);
    this.transport.send(msg);
  }

  destroy(): void {
    this.unsub();
    this.handlers.clear();
  }
}
