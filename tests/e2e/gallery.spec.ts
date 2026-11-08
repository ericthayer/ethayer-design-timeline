import { expect, expectNoAxeViolations, test } from './fixtures.ts';

test.describe('editorial gallery (spec 003, 006 FR-535)', () => {
  test('renders placeholder figures with spans and captions (US12, FR-212, FR-214)', async ({
    page,
  }) => {
    await page.goto('/work/cobank-design-system');
    const gallery = page.getByRole('list', { name: 'Project gallery' });
    await expect(gallery).toBeVisible();
    await expect(gallery.locator('li')).toHaveCount(5);
    await expect(gallery.locator('li[data-span="feature"]')).toHaveCount(1);
    await expect(page.getByText('Placeholder · Token editor')).toBeVisible();
  });

  test('figures take the full row or half of it on desktop (FR-535)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/work/cobank-design-system');
    const feature = await page.locator('.pd__figure[data-span="feature"]').boundingBox();
    const small = await page.locator('.pd__figure[data-span="sm"]').first().boundingBox();
    expect(feature && small && feature.width > small.width * 1.8).toBe(true);
  });

  test('captions sit under the media, not over it (FR-535)', async ({ page }) => {
    await page.goto('/work/cobank-design-system');
    const figure = page.locator('.pd__figure[data-span="feature"]');
    const frame = await figure.locator('.pd__frame').boundingBox();
    const caption = await figure.locator('figcaption').boundingBox();
    expect(frame && caption && caption.y >= frame.y + frame.height).toBe(true);
  });

  test('stacks in one column on a phone (FR-535)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/work/cobank-design-system');
    const gallery = await page.locator('.pd__gallery').boundingBox();
    const small = await page.locator('.pd__figure[data-span="sm"]').first().boundingBox();
    expect(small && gallery && small.width >= gallery.width - 2).toBe(true);
  });

  test('sets the focal point as a custom property (FR-213)', async ({ page }) => {
    await page.goto('/work/cobank-design-system');
    const focal = await page
      .locator('.pd__figure[data-span="feature"]')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--focal').trim());
    expect(focal).toBe('30% 40%');
  });

  test('has no axe violations with the gallery open (SC-2)', async ({ page }) => {
    await page.goto('/work/cobank-design-system');
    await expect(page.getByRole('list', { name: 'Project gallery' })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
