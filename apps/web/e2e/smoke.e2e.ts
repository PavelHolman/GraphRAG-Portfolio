import { expect, test } from '@playwright/test';

test('the page renders the resume sections and a Turn streams to the caption', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#about')).toBeVisible();
  await expect(page.locator('#experience h3').first()).toBeVisible();
  const input = page.getByLabel('Ask about this resume');
  const askButton = page.getByRole('button', { name: '✦ Ask about me' });
  // The field does not exist until asked for; the button morphs into it and back.
  await expect(input).toBeHidden();
  await askButton.click();
  await expect(input).toBeFocused();
  await expect(askButton).toBeHidden();
  // The field takes the whole actions row's place.
  await expect(page.locator('.actions')).toBeHidden();
  await input.press('Escape');
  await expect(input).toBeHidden();
  await expect(askButton).toBeFocused();
  await askButton.click();
  await expect(input).toBeFocused();
  await input.fill('Tell me about your Effect work');
  await page.getByRole('button', { name: 'send' }).click();
  await expect(page.locator('.caption')).toBeVisible();
  await expect(page.locator('.caption .cite').first()).toBeVisible({ timeout: 30_000 });
});

test('hints keep rotating while the empty field has focus', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: '✦ Ask about me' }).click();
  await expect(page.getByLabel('Ask about this resume')).toBeFocused();
  const ghost = page.locator('.ghost .cycle');
  const first = await ghost.textContent();
  // The hint cycles every 6 s; focus alone must not pause it, only text in the field.
  await page.clock.fastForward(6500);
  await expect(ghost).not.toHaveText(first ?? '');
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
