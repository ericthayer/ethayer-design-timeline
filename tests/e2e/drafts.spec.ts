// Drafts (spec 007, FR-600–FR-602): hidden in production, shown under /admin after sign-in.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { mockGitHub, TOKEN } from './github-mock.ts';

const DRAFT = { slug: 'motion-reel', title: 'Motion Demo Reel' };

async function signIn(page: Page): Promise<void> {
  await page.getByLabel('GitHub token').fill(TOKEN);
  await page.getByRole('button', { name: 'Verify' }).click();
}

test.describe('drafts under /admin (FR-602)', () => {
  test('a draft opens from its /admin link after sign-in', async ({ page }) => {
    await mockGitHub(page);
    await page.goto(`/admin/work/${DRAFT.slug}`);
    await signIn(page);
    await expect(page.getByRole('dialog', { name: DRAFT.title })).toBeVisible();
  });

  test('keeps the Vimeo facade click-to-load (NFR-06)', async ({ page }) => {
    await mockGitHub(page);
    await page.goto(`/admin/work/${DRAFT.slug}`);
    await signIn(page);
    const gallery = page.getByRole('list', { name: 'Project gallery' });
    await expect(gallery.locator('iframe')).toHaveCount(0);
    await gallery.getByRole('button', { name: /Play “Motion demo reel”/ }).click();
    await expect(gallery.locator('iframe')).toHaveCount(1);
  });
});
