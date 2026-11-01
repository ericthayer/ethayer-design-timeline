import { expect, expectNoAxeViolations, renderEverything, test } from './fixtures.ts';

// Spec 006: the Projects view, the header view switch, and the contact footer.
test.describe('projects view', () => {
  test('groups every project under a category heading (US20, FR-510–FR-513)', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveTitle('Projects — Eric Thayer');
    const views = page.getByRole('navigation', { name: 'Views' });
    await expect(views.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await renderEverything(page);
    const grid = page.getByRole('list', { name: 'Projects by category' });
    await expect(grid.getByRole('heading', { level: 2 })).toHaveText([
      'Design systems',
      'Agentic engineering',
      'Front-end platforms',
      'Product and UX design',
      'Motion and media',
    ]);
    await expect(page.locator('project-card')).toHaveCount(28);
    await expect(page.locator('[data-type="end-cap"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Skip to end of timeline' })).toBeHidden();
  });

  test('switches views without a reload and hands the wall focus (US21, FR-521)', async ({
    page,
  }) => {
    await page.goto('/');
    const views = page.getByRole('navigation', { name: 'Views' });
    await views.getByRole('link', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page).toHaveTitle('Projects — Eric Thayer');
    await expect(page.locator('#wall')).toBeFocused();
    await expect(page.getByRole('heading', { level: 2, name: 'Design systems' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(views.getByRole('link', { name: 'Experience' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('opens the shared dialog, steps in Projects order, and closes back to Projects (FR-530, FR-531)', async ({
    page,
  }) => {
    await page.goto('/projects');
    const link = page.getByRole('link', { name: 'Multi-Framework Design System' });
    await link.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Design systems · Front-end platforms')).toBeVisible();
    await dialog.getByRole('button', { name: /^Next: / }).click();
    await expect(page).toHaveURL(/\/work\/figma-token-pipeline$/);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page).toHaveTitle('Projects — Eric Thayer');
  });

  test('ends both views with the contact footer (US22, FR-540, FR-541)', async ({ page }) => {
    for (const path of ['/', '/projects']) {
      await page.goto(path);
      const footer = page.getByRole('contentinfo');
      await expect(footer.getByRole('heading', { level: 2, name: 'Let’s talk' })).toBeAttached();
      for (const name of ['Résumé', 'LinkedIn', 'GitHub', 'Email']) {
        await expect(footer.getByRole('link', { name })).toBeAttached();
      }
      const portrait = footer.getByRole('img');
      await expect(portrait).toHaveAttribute('loading', 'lazy');
      await expect(portrait).toHaveAttribute('width', '1440');
      await expect(portrait).toHaveAttribute('height', '1800');
    }
  });

  test('has no axe violations with every card and the footer rendered', async ({ page }) => {
    await page.goto('/projects');
    await renderEverything(page);
    await expectNoAxeViolations(page);
  });

  test('fits the header on one line at 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/projects');
    const header = page.locator('.site-header');
    const width = await header.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(width).toBe(0);
    await expect(page.getByRole('link', { name: 'Experience' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause motion' })).toBeVisible();
  });
});
