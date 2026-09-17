import { expect, test } from '@playwright/test';

test('the page renders the resume sections and a Turn streams to the caption', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#about')).toBeVisible();
  await expect(page.locator('#experience h3').first()).toBeVisible();
  const input = page.getByLabel('Ask about this resume');
  await input.fill('Tell me about your Effect work');
  await page.getByRole('button', { name: 'send' }).click();
  await expect(page.locator('.caption')).toBeVisible();
  await expect(page.locator('.caption .cites button').first()).toBeVisible({ timeout: 30_000 });
});

test('the Turn endpoint speaks NDJSON in ADR 0003 order', async ({ request }) => {
  const res = await request.post('/api/turn', { data: { prompt: 'Where did you study?' } });
  expect(res.ok()).toBe(true);
  const lines = (await res.text())
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as { type: string });
  expect(lines[0]?.type).toBe('turn-started');
  expect(lines[1]?.type).toBe('subgraph');
  expect(lines.at(-1)?.type).toBe('turn-finished');
});
