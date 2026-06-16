export class TabcoordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TabcoordError';
  }
}

export class StoreDestroyedError extends TabcoordError {
  constructor(storeName: string) {
    super(`Store "${storeName}" has been destroyed`);
    this.name = 'StoreDestroyedError';
  }
}

export class LockTimeoutError extends TabcoordError {
  constructor(lockName: string) {
    super(`Lock "${lockName}" acquire timed out`);
    this.name = 'LockTimeoutError';
  }
}

export class LockManagerDestroyedError extends TabcoordError {
  constructor() {
    super('LockManager has been destroyed');
    this.name = 'LockManagerDestroyedError';
  }
}

export class BootstrapTimeoutError extends TabcoordError {
  constructor(storeName: string) {
    super(`Store "${storeName}" bootstrap timed out — no leader elected`);
    this.name = 'BootstrapTimeoutError';
  }
}
