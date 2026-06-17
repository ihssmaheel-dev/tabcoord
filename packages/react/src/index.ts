// React hooks
export { useSharedStore } from './use-shared-store.js';
export { useSharedEvent } from './use-shared-event.js';
export { createStoreContext } from './create-store-context.js';

// Re-export everything from tabcoord so users only need one install
export {
  createSharedStore,
  SharedStoreHandle,
  eventBus,
  leaderElection,
  lockManager,
  getTabId,
  tick,
  compare,
  serialize,
  deserialize,
  resetCounter,
  advanceCounter,
  chunk,
  createChunkAssembler,
  apply,
  isPatch,
  TabcoordError,
  StoreDestroyedError,
  LockTimeoutError,
  LockManagerDestroyedError,
  BootstrapTimeoutError,
} from 'tabcoord';

export type {
  CreateSharedStoreOptions,
  EventBus,
  BusEvent,
  LeaderElection,
  LeaderElectionOptions,
  LockManager,
  LockManagerOptions,
  Clock,
  ChunkMessage,
  AcceptResult,
  Patch,
  InternalStoreInterface,
  Transport,
  MessageHandler,
  MessageType,
  WireMessage,
  MessageMeta,
} from 'tabcoord';
