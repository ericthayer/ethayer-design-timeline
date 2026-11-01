import { expect, expectNoAxeViolations, test } from './fixtures.ts';

test.describe('résumé dialog (spec 002)', () => {
  test('opens from the header, closes with Esc, and restores focus (US10)', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('banner').getByRole('link', { name: 'Résumé' });
    await link.click();
    const dialog = page.getByRole('dialog', { name: 'Eric Thayer' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/resume$/);
    await expect(page).toHaveTitle('Résumé — Eric Thayer');
    await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused();
    await expect(dialog.getByRole('heading', { name: 'Experience' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
    await expect(link).toBeFocused();
  });

  test('opens from the hero and closes with Back (FR-124)', async ({ page }) => {
    await page.goto('/');
    await page.locator('.site-hero').getByRole('link', { name: 'Résumé' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
  });

  test('deep link opens the résumé; Close returns to the wall', async ({ page }) => {
    await page.goto('/resume');
    const dialog = page.getByRole('dialog', { name: 'Eric Thayer' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Eric Thayer' })).toBeFocused();
  });

  test('fits at 320 px: no overflow, both bar actions on screen (spec 006 FR-533)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/resume');
    const close = page.getByRole('button', { name: 'Close' });
    await expect(close).toBeVisible();
    const box = await close.boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(320);
    const overflow = await page
      .locator('.rd__body')
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBe(0);
  });

  test('has no axe violations while open', async ({ page }) => {
    await page.goto('/resume');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
