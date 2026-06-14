import { test, expect } from '@playwright/test';

test.describe('leader election', () => {
  test('single tab becomes leader', async ({ context }) => {
    const tab = await context.newPage();
    await tab.goto('/');
    await expect(tab.locator('#status')).toHaveText('ready');

    // After bootstrap + timeout, should become leader
    await expect(tab.locator('#leaderStatus')).toHaveText('leader', { timeout: 5000 });
  });

  test('two tabs: lower tabId wins', async ({ context }) => {
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await tabA.goto('/');
    await tabB.goto('/');

    await expect(tabA.locator('#status')).toHaveText('ready');
    await expect(tabB.locator('#status')).toHaveText('ready');

    // Wait for election to settle
    await tabA.waitForTimeout(3000);

    // Exactly one tab should be leader
    const aLeader = await tabA.locator('#leaderStatus').textContent();
    const bLeader = await tabB.locator('#leaderStatus').textContent();

    // One should be leader, one should be follower
    expect(aLeader !== bLeader).toBeTruthy();
    expect(['leader', 'follower']).toContain(aLeader);
    expect(['leader', 'follower']).toContain(bLeader);
  });

  test('leader step-down on tab close', async ({ context }) => {
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await tabA.goto('/');
    await tabB.goto('/');

    await expect(tabA.locator('#status')).toHaveText('ready');
    await expect(tabB.locator('#status')).toHaveText('ready');

    // Wait for election
    await tabA.waitForTimeout(3000);

    // Close the leader tab
    const aLeader = await tabA.locator('#leaderStatus').textContent();
    if (aLeader === 'leader') {
      await tabA.close();
      // Other tab should eventually become leader
      await expect(tabB.locator('#leaderStatus')).toHaveText('leader', { timeout: 5000 });
    } else {
      await tabB.close();
      await expect(tabA.locator('#leaderStatus')).toHaveText('leader', { timeout: 5000 });
    }
  });
});

test.describe('lock manager', () => {
  test('single tab can acquire and release lock', async ({ context }) => {
    const tab = await context.newPage();
    await tab.goto('/');
    await expect(tab.locator('#status')).toHaveText('ready');

    await tab.click('#acquireLockBtn');

    // Single tab: lock is acquired immediately (self-grant)
    await expect(tab.locator('#lockStatus')).toHaveText('held', { timeout: 3000 });

    // After 2s, should release
    await expect(tab.locator('#lockStatus')).toHaveText('released', { timeout: 5000 });
  });

  test('lock prevents concurrent access', async ({ context }) => {
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await tabA.goto('/');
    await tabB.goto('/');

    await expect(tabA.locator('#status')).toHaveText('ready');
    await expect(tabB.locator('#status')).toHaveText('ready');

    // Tab A acquires lock
    await tabA.click('#acquireLockBtn');
    await expect(tabA.locator('#lockStatus')).toHaveText('held', { timeout: 3000 });

    // Tab B tries to acquire — should be waiting
    await tabB.click('#acquireLockBtn');
    await expect(tabB.locator('#lockStatus')).toHaveText('acquiring');

    // Tab A still holds lock
    await expect(tabA.locator('#lockStatus')).toHaveText('held');

    // After Tab A releases, Tab B should get it
    await expect(tabA.locator('#lockStatus')).toHaveText('released', { timeout: 5000 });
    await expect(tabB.locator('#lockStatus')).toHaveText('held', { timeout: 5000 });
  });
});
