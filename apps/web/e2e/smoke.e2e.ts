import { expect, test } from '@playwright/test';

test('the page renders the resume sections and a Turn streams to the caption', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#about')).toBeVisible();
  await expect(page.locator('#experience h3').first()).toBeVisible();
  const input = page.getByLabel('Ask about this resume');
  await expect(input).toBeHidden();
  await page.getByRole('button', { name: '✦ Ask about me' }).click();
  await expect(input).toBeFocused();
  await input.fill('Tell me about your Effect work');
  await page.getByRole('button', { name: 'send' }).click();
  await expect(page.locator('.caption')).toBeVisible();
  await expect(page.locator('.caption .cite').first()).toBeVisible({ timeout: 30_000 });
});

test('the CV is linked, served and printable', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('header').getByRole('link', { name: 'Download CV' })).toHaveAttribute(
    'href',
    '/cv.pdf',
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /\/hero\.png$/,
  );
  expect((await request.get('/hero.png')).headers()['content-type']).toContain('image/png');
  const pdf = await request.get('/cv.pdf');
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  await page.goto('/print');
  await expect(page.getByRole('heading', { name: 'Experience' })).toBeVisible();
});

test('the Turn endpoint speaks NDJSON in ADR 0003 order', async ({ request }) => {
  const res = await request.post('/api/turn', { data: { prompt: 'Where did you study?' } });
  expect(res.ok()).toBe(true);
  const lines = (await res.text())
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as { type: string });
  expect(lines[0], JSON.stringify(lines[0])).toMatchObject({ type: 'turn-started' });
  expect(lines[1]?.type).toBe('subgraph');
  expect(lines.at(-1)?.type).toBe('turn-finished');
});
