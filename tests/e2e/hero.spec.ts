import { expect, expectNoAxeViolations, test } from './fixtures.ts';

test.describe('hero (spec 002)', () => {
  for (const [width, height] of [
    [390, 844],
    [1280, 900],
    [1920, 1080],
  ] as const) {
    test(`header and hero fill one ${String(width)}×${String(height)} viewport (FR-101)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      const bottom = await page
        .locator('.site-hero')
        .evaluate((el) => el.getBoundingClientRect().bottom);
      expect(bottom).toBeGreaterThanOrEqual(height - 1);
      await expect(page.getByRole('link', { name: 'Explore the timeline' })).toBeInViewport();
    });
  }

  test('CTA moves the visitor and focus to the timeline (US9, FR-103)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Explore the timeline' }).click();
    const wall = page.getByRole('region', { name: 'Career timeline' });
    await expect(wall).toBeFocused();
    await expect(wall).toBeInViewport();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Agentic Engineering Loop' })).toBeFocused();
  });

  test('CTA works from the keyboard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Explore the timeline' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Career timeline' })).toBeFocused();
  });

  test('has no axe violations', async ({ page }) => {
    await page.goto('/');
    await expectNoAxeViolations(page);
  });
});
