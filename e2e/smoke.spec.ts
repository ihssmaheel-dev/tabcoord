import { test, expect } from '@playwright/test';

test('page loads without crash', async ({ page }) => {
  await page.goto('/');
  expect(await page.title()).toBeDefined();
});

test('two tabs can open without error', async ({ context }) => {
  const tabA = await context.newPage();
  const tabB = await context.newPage();
  await tabA.goto('/');
  await tabB.goto('/');
  expect(await tabA.title()).toBeDefined();
  expect(await tabB.title()).toBeDefined();
});
