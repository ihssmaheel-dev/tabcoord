function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let _tabId: string | null = null;

export function getTabId(): string {
  if (!_tabId) {
    _tabId = generateUUID();
  }
  return _tabId;
}

export function resetTabId(): void {
  _tabId = null;
}
