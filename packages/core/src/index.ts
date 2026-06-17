export { createSharedStore } from './create-shared-store.js';
export type { CreateSharedStoreOptions } from './create-shared-store.js';
export { SharedStoreHandle } from './shared-store-handle.js';
export { eventBus, resetEventId } from './event-bus.js';
export type { EventBus, BusEvent } from './event-bus.js';
export { InternalStore } from './internal-store.js';
export { NoopInternalStore } from './noop-internal-store.js';
export { MessageBus, stripReservedKeys, resetMsgId } from './message-bus.js';
export type { MessageType, WireMessage, MessageMeta } from './message-bus.js';
export { getTabId, resetTabId } from './tab-id.js';
export { tick, compare, serialize, deserialize, resetCounter, advanceCounter } from './clock.js';
export type { Clock } from './clock.js';

// Bind clock reset to tab-id so resetTabId() also resets the counter
import { _bindResetCounter } from './tab-id.js';
import { resetCounter } from './clock.js';
_bindResetCounter(resetCounter);
export { chunk, createChunkAssembler } from './chunker.js';
export type { ChunkMessage, AcceptResult } from './chunker.js';
export { apply, isPatch } from './diff.js';
export type { Patch } from './diff.js';
export {
  setItem as syncStorageSetItem,
  getItem as syncStorageGetItem,
  removeItem as syncStorageRemoveItem,
} from './sync-storage.js';
export { persistState, rehydrateState, clearPersistedState } from './persist.js';
export type { PersistConfig, PersistedState } from './persist.js';
export { resolveInitial, clearFactoryCache } from './resolve-initial.js';
export type { InternalStoreInterface } from './internal-store-interface.js';
export {
  createTransport, destroyTransport, getTransport,
} from './transport/resolver.js';
export type { Transport, MessageHandler } from './transport/types.js';
export { leaderElection } from './leader-election.js';
export type { LeaderElection, LeaderElectionOptions } from './leader-election.js';
export { lockManager } from './lock-manager.js';
export type { LockManager, LockManagerOptions } from './lock-manager.js';
export {
  TabcoordError,
  StoreDestroyedError,
  LockTimeoutError,
  LockManagerDestroyedError,
  BootstrapTimeoutError,
} from './errors.js';
