import { test, expect } from '@playwright/test';

test.describe('multi-tab state sync', () => {
  test('two tabs share state via BroadcastChannel', async ({ context }) => {
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await tabA.goto('/');
    await tabB.goto('/');

    // Wait for both tabs to be ready and synced
    await expect(tabA.locator('#status')).toHaveText('ready');
    await expect(tabB.locator('#status')).toHaveText('ready');
    await expect(tabA.locator('#storeStatus')).toHaveText('synced');
    await expect(tabB.locator('#storeStatus')).toHaveText('synced');

    // Tab A increments
    await tabA.click('#incrementBtn');
    await expect(tabB.locator('#storeValue')).toHaveText('{"count":1,"str":""}');
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
    await expect(tabA.locator('#storeStatus')).toHaveText('synced');
    await expect(tabB.locator('#storeStatus')).toHaveText('synced');

    // Tab A sets "hello"
    await tabA.click('#setStrBtn');
    await expect(tabB.locator('#storeValue')).toHaveText('{"count":0,"str":"hello"}');

    // Wait for sync to fully settle before next action
    await expect(tabA.locator('#storeStatus')).toHaveText('synced');
    await expect(tabB.locator('#storeStatus')).toHaveText('synced');
    await tabA.waitForTimeout(500);

    // Tab B increments
    await tabB.click('#incrementBtn');
    await expect(tabA.locator('#storeValue')).toHaveText('{"count":1,"str":"hello"}');
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
    await expect(tabB.locator('#eventCount')).toHaveText('1');

    // Tab A should also receive its own event (local handlers are invoked)
    await expect(tabA.locator('#eventCount')).toHaveText('1');
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
    await expect(tabB.locator('#eventCount')).toHaveText('3');
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
    await expect(tabA.locator('#storeStatus')).toHaveText('synced');
    await expect(tabB.locator('#storeStatus')).toHaveText('synced');

    await tabA.click('#incrementBtn');
    await expect(tabA.locator('#storeValue')).toHaveText('{"count":1,"str":""}');
    await expect(tabB.locator('#storeValue')).toHaveText('{"count":1,"str":""}');

    await context.close();
  });
});
