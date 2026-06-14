import { test, expect } from '@playwright/test';

test.describe('multi-tab state sync', () => {
  test('two tabs share state via BroadcastChannel', async ({ context }) => {
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await tabA.goto('/');
    await tabB.goto('/');

    // Wait for both tabs to be ready
    await expect(tabA.locator('#status')).toHaveText('ready');
    await expect(tabB.locator('#status')).toHaveText('ready');

    // Tab A increments
    await tabA.click('#incrementBtn');
    await tabA.waitForTimeout(300); // allow sync to propagate

    // Tab B should see the incremented value
    const bValue = await tabB.locator('#storeValue').textContent();
    expect(JSON.parse(bValue!)).toEqual({ count: 1, str: '' });

    // Tab A also sees it
    const aValue = await tabA.locator('#storeValue').textContent();
    expect(JSON.parse(aValue!)).toEqual({ count: 1, str: '' });
  });

  test('three tabs converge on initial state', async ({ context }) => {
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    const tabC = await context.newPage();

    await tabA.goto('/');
    await tabB.goto('/');
    await tabC.goto('/');

    await expect(tabA.locator('#status')).toHaveText('ready');
    await expect(tabB.locator('#status')).toHaveText('ready');
    await expect(tabC.locator('#status')).toHaveText('ready');

    // All three should eventually have synced state
    await expect(tabA.locator('#storeStatus')).toHaveText('synced');
    await expect(tabB.locator('#storeStatus')).toHaveText('synced');
    await expect(tabC.locator('#storeStatus')).toHaveText('synced');
  });

  test('state syncs back and forth between two tabs', async ({ context }) => {
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await tabA.goto('/');
    await tabB.goto('/');

    await expect(tabA.locator('#status')).toHaveText('ready');
    await expect(tabB.locator('#status')).toHaveText('ready');

    // Tab A sets "hello"
    await tabA.click('#setStrBtn');
    await tabA.waitForTimeout(300);

    let bVal = await tabB.locator('#storeValue').textContent();
    expect(JSON.parse(bVal!)).toEqual({ count: 0, str: 'hello' });

    // Tab B increments
    await tabB.click('#incrementBtn');
    await tabB.waitForTimeout(300);

    let aVal = await tabA.locator('#storeValue').textContent();
    expect(JSON.parse(aVal!)).toEqual({ count: 1, str: 'hello' });
  });
});

test.describe('multi-tab event bus', () => {
  test('events propagate to other tabs', async ({ context }) => {
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await tabA.goto('/');
    await tabB.goto('/');

    await expect(tabA.locator('#status')).toHaveText('ready');
    await expect(tabB.locator('#status')).toHaveText('ready');

    // Tab A emits an event
    await tabA.click('#emitEventBtn');
    await tabA.waitForTimeout(300);

    // Tab B should receive it
    const bEvents = await tabB.locator('#eventCount').textContent();
    expect(Number(bEvents)).toBeGreaterThanOrEqual(1);

    // Tab A should NOT have received its own event (filtered by source)
    const aEvents = await tabA.locator('#eventCount').textContent();
    expect(Number(aEvents)).toBe(0);
  });

  test('multiple events are received in order', async ({ context }) => {
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await tabA.goto('/');
    await tabB.goto('/');

    await expect(tabA.locator('#status')).toHaveText('ready');
    await expect(tabB.locator('#status')).toHaveText('ready');

    // Tab A emits multiple events
    await tabA.click('#emitEventBtn');
    await tabA.click('#emitEventBtn');
    await tabA.click('#emitEventBtn');
    await tabA.waitForTimeout(500);

    const bEvents = await tabB.locator('#eventCount').textContent();
    expect(Number(bEvents)).toBe(3);
  });
});

test.describe('cross-browser context', () => {
  test('state sync works in all browser contexts', async ({ browser }) => {
    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await tabA.goto('/');
    await tabB.goto('/');

    await expect(tabA.locator('#status')).toHaveText('ready');
    await expect(tabB.locator('#status')).toHaveText('ready');

    await tabA.click('#incrementBtn');
    await tabA.waitForTimeout(300);

    const aVal = await tabA.locator('#storeValue').textContent();
    const bVal = await tabB.locator('#storeValue').textContent();
    expect(JSON.parse(aVal!)).toEqual({ count: 1, str: '' });
    expect(JSON.parse(bVal!)).toEqual({ count: 1, str: '' });

    await context.close();
  });
});
