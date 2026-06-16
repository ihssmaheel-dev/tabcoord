export class TabcoordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TabcoordError';
  }
}

export class StoreDestroyedError extends TabcoordError {
  constructor(storeName: string) {
    super(`"${storeName}" destroyed`);
    this.name = 'StoreDestroyedError';
  }
}

export class LockTimeoutError extends TabcoordError {
  constructor(lockName: string) {
    super(`"${lockName}" timeout`);
    this.name = 'LockTimeoutError';
  }
}

export class LockManagerDestroyedError extends TabcoordError {
  constructor() {
    super('LockManager destroyed');
    this.name = 'LockManagerDestroyedError';
  }
}

export class BootstrapTimeoutError extends TabcoordError {
  constructor(storeName: string) {
    super(`"${storeName}" bootstrap timeout`);
    this.name = 'BootstrapTimeoutError';
  }
}
