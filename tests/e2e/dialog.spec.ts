import { expect, expectNoAxeViolations, test } from './fixtures.ts';

test.describe('project dialog', () => {
  test('opens on click, focuses the title, and closes with Esc (US2, FR-053)', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: 'Agentic Engineering Loop' });
    await link.click();
    const dialog = page.getByRole('dialog', { name: 'Agentic Engineering Loop' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/work\/agentic-engineering-loop$/);
    await expect(page).toHaveTitle('Agentic Engineering Loop — Eric Thayer');
    await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
    await expect(link).toBeFocused();
  });

  test('opens with Enter and closes with browser Back (FR-060)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Spec & Drift Detection' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
  });

  test('steps with Next/Previous without stacking history (FR-055)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Agentic Engineering Loop' }).click();
    await page.getByRole('button', { name: /^Next: / }).click();
    await expect(page).toHaveURL(/\/work\/cobank-design-system$/);
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/\/work\/figma-token-pipeline$/);
    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(/\/work\/cobank-design-system$/);
    await expect(page.getByText('02 / 28')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('deep-links into a later batch and returns focus there (US5, FR-053)', async ({ page }) => {
    await page.goto('/work/motion-reel');
    const dialog = page.getByRole('dialog', { name: 'Motion Demo Reel' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /loads Vimeo/ })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: 'Motion Demo Reel' })).toBeFocused();
  });

  test('sends unknown slugs back to the wall (US5)', async ({ page }) => {
    await page.goto('/work/not-a-project');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('locks page scroll while open (FR-054)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/work/dmns');
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
      'hidden',
    );
  });

  test('has no axe violations when open', async ({ page }) => {
    await page.goto('/work/drift-detection');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
