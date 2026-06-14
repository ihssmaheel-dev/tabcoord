import { describe, it, expect } from 'vitest';

describe('tab-id', () => {
  it('returns a string', async () => {
    const { getTabId } = await import('../tab-id.js');
    const id = getTabId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('is a singleton within the module', async () => {
    const { getTabId } = await import('../tab-id.js');
    expect(getTabId()).toBe(getTabId());
  });

  it('looks like a UUID (with crypto)', async () => {
    const { getTabId } = await import('../tab-id.js');
    expect(getTabId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
