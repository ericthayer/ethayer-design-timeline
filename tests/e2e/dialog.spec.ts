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

test.describe('split-screen dialog (spec 006, FR-534)', () => {
  test('scrolls each pane on its own at 1280 px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/work/cobank-design-system');
    const details = page.getByRole('region', { name: 'Details' });
    const overview = page.getByRole('region', { name: 'Overview' });
    const hero = await details.locator('.pd__hero').boundingBox();
    const summary = await details.locator('.pd__summary').boundingBox();
    expect(hero && summary && summary.y >= hero.y + hero.height).toBe(true);
    await details.evaluate((el) => {
      el.scrollBy(0, 600);
    });
    expect(await details.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await overview.evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('resizes by keyboard, keeps ←/→ off project navigation, and holds across projects', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/work/cobank-design-system');
    const handle = page.getByRole('separator', { name: 'Resize the overview panel' });
    await expect(handle).toHaveAttribute('aria-valuenow', '40');
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', '44');
    await expect(page).toHaveURL(/\/work\/cobank-design-system$/);
    await page.keyboard.press('End');
    await expect(handle).toHaveAttribute('aria-valuenow', '60');
    const overview = await page.getByRole('region', { name: 'Overview' }).boundingBox();
    expect(overview && Math.abs(overview.width - 1280 * 0.6)).toBeLessThan(2);
    await page.getByRole('button', { name: /^Next:/ }).click();
    await expect(page.getByRole('separator')).toHaveAttribute('aria-valuenow', '60');
  });

  test('resizes by drag within its limits', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/work/cobank-design-system');
    const handle = page.getByRole('separator');
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();
    if (!box) throw new Error('no separator');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    // Wait out the opening View Transition, which takes hit testing while it runs.
    await expect
      .poll(() => page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.className, { x, y }))
      .toBe('pd__split');
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(100, y, { steps: 4 });
    await page.mouse.up();
    await expect(handle).toHaveAttribute('aria-valuenow', '28');
  });

  test('stacks in one scroll without a separator below 900 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/work/cobank-design-system');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('separator')).toBeHidden();
  });

  test('has no axe violations at 1280 px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/work/cobank-design-system');
    await expect(page.getByRole('separator')).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
