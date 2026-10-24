import { expect, expectNoAxeViolations, test } from './fixtures.ts';

test.describe('bento gallery (spec 003)', () => {
  test('renders placeholder tiles with spans and captions (US12, FR-212, FR-214)', async ({
    page,
  }) => {
    await page.goto('/work/cobank-design-system');
    const bento = page.getByRole('list', { name: 'Project gallery' });
    await expect(bento).toBeVisible();
    await expect(bento.locator('li')).toHaveCount(5);
    await expect(bento.locator('li[data-span="feature"]')).toHaveCount(1);
    await expect(page.getByText('Placeholder · Token editor')).toBeVisible();
  });

  test('tiles take their span sizes on desktop (FR-214)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/work/cobank-design-system');
    const feature = page.locator('.pd__tile[data-span="feature"]');
    const box = await feature.boundingBox();
    const small = await page.locator('.pd__tile[data-span="sm"]').first().boundingBox();
    expect(box && small && box.width > small.width * 1.8).toBe(true);
  });

  test('collapses to two columns on a phone (FR-214)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/work/cobank-design-system');
    const feature = await page.locator('.pd__tile[data-span="feature"]').boundingBox();
    const bento = await page.locator('.pd__bento').boundingBox();
    expect(feature && bento && feature.width >= bento.width - 2).toBe(true);
  });

  test('sets the focal point as a custom property (FR-213)', async ({ page }) => {
    await page.goto('/work/cobank-design-system');
    const focal = await page
      .locator('.pd__tile[data-span="feature"]')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--focal').trim());
    expect(focal).toBe('30% 40%');
  });

  test('keeps the Vimeo facade click-to-load (NFR-06)', async ({ page }) => {
    await page.goto('/work/motion-reel');
    const bento = page.getByRole('list', { name: 'Project gallery' });
    await expect(bento.locator('iframe')).toHaveCount(0);
    await bento.getByRole('button', { name: /Play “Motion demo reel”/ }).click();
    await expect(bento.locator('iframe')).toHaveCount(1);
  });

  test('has no axe violations with the gallery open (SC-2)', async ({ page }) => {
    await page.goto('/work/cobank-design-system');
    await expect(page.getByRole('list', { name: 'Project gallery' })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
