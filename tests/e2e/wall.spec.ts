import { expect, expectNoAxeViolations, renderEverything, test } from './fixtures.ts';

test.describe('wall', () => {
  test('opens with the identity poster and the first batch (US1, FR-008)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Eric Thayer' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'CoBank' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Agentic Engineering Loop' })).toBeVisible();
  });

  test('scrolls vertically at 1800 px and horizontally above it (FR-002, FR-003)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1800, height: 1000 });
    await page.goto('/');
    await expect(page.locator('timeline-wall')).toHaveAttribute('data-mode', 'vertical');

    await page.setViewportSize({ width: 1801, height: 1000 });
    await expect(page.locator('timeline-wall')).toHaveAttribute('data-mode', 'horizontal');
  });

  test('maps a vertical wheel to horizontal scroll in horizontal mode (FR-005)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.locator('timeline-wall')).toHaveAttribute('data-mode', 'horizontal');
    await page.mouse.move(960, 600);
    await page.mouse.wheel(0, 800);
    await expect
      .poll(() => page.locator('.wall__grid').evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('loads batches as the visitor scrolls and ends with the end-cap (FR-070–FR-072)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const endCap = page.getByRole('heading', { level: 2, name: 'Education' });
    for (let i = 0; i < 12 && !(await endCap.isVisible()); i += 1) {
      await page.mouse.wheel(0, 2500);
      await page.waitForTimeout(150);
    }
    await expect(endCap).toBeVisible();
    await expect(page.locator('#wall-status')).toHaveText(/Loaded \d+ more projects/);
    await expect(page.locator('project-card')).toHaveCount(28);
  });

  test('renders about one Swiss card in four (FR-011b)', async ({ page }) => {
    await page.goto('/');
    await renderEverything(page);
    await expect(page.locator('.card--swiss')).toHaveCount(7);
    await expect(page.locator('.card--standard')).toHaveCount(21);
  });

  test('moves focus between cards with arrow keys (FR-081)', async ({ page }) => {
    await page.goto('/');
    const first = page.getByRole('link', { name: 'Agentic Engineering Loop' });
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('link', { name: 'Multi-Framework Design System' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(first).toBeFocused();
  });

  test('pauses motion from the header and remembers it (FR-080)', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Pause motion' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Pause motion' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('starts paused under prefers-reduced-motion (US4)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  });

  test('has no axe violations with every card rendered', async ({ page }) => {
    await page.goto('/');
    await renderEverything(page);
    await expectNoAxeViolations(page);
  });
});
