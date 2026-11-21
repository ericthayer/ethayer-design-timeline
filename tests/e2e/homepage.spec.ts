import { expect, expectNoAxeViolations, test } from './fixtures.ts';

for (const width of [390, 1280]) {
  test(`production root shows the approved overview at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'I build design systems,and the agents that ship them.',
    );
    for (const name of ['Selected work', 'What I do', 'Career']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeAttached();
    }
    await expect(page.locator('.home-selected project-card')).toHaveCount(3);
    await expect(page.locator('#wall')).toBeHidden();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    const ids = await page.locator('[id]').evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(new Set(ids).size).toBe(ids.length);
    await expectNoAxeViolations(page);
  });
}

test('a repeated homepage project returns focus to the card that opened it', async ({ page }) => {
  await page.goto('/');
  const card = page
    .locator('.home-categories')
    .getByRole('link', { name: 'Agentic Engineering Loop' });
  await card.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /^Next:/ }).click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(card).toBeFocused();
});

test('overview, experience and projects survive browser Back and Forward', async ({ page }) => {
  await page.goto('/');
  const views = page.getByRole('navigation', { name: 'Views' });
  await views.getByRole('link', { name: 'Experience' }).click();
  await expect(page).toHaveURL(/\/experience$/);
  await expect(page.locator('#wall')).toBeFocused();
  await views.getByRole('link', { name: 'Overview' }).click();
  await expect(page.locator('.home-hero')).toBeVisible();
  await expect(page.locator('#main')).toBeFocused();
  await page.goBack();
  await expect(page.locator('#wall')).toBeVisible();
  await page.goForward();
  await expect(views.getByRole('link', { name: 'Overview' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('.home-hero')).toBeVisible();
});

test('homepage links reach later batched category and era markers', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('.home-category')
    .filter({ hasText: 'Motion and media' })
    .getByRole('link', { name: /^See all/ })
    .click();
  await expect(page).toHaveURL(/\/projects#category-motion-media$/);
  await expect(page.locator('#category-motion-media')).toBeInViewport();
  await page.goto('/');
  await page
    .locator('.home-role')
    .filter({ hasText: 'Defense Language Institute' })
    .getByRole('link')
    .click();
  await expect(page).toHaveURL(/\/experience#era-dli$/);
  await expect(page.locator('#era-dli')).toBeInViewport();
});

test('overview videos keep playing after visiting a wide horizontal wall', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const video = page.locator('.site-home video').first();
  await video.scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(false);
  const views = page.getByRole('navigation', { name: 'Views' });
  await views.getByRole('link', { name: 'Experience' }).click();
  await expect(page.locator('timeline-wall')).toHaveAttribute('data-mode', 'horizontal');
  await views.getByRole('link', { name: 'Overview' }).click();
  await video.scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(false);
});
