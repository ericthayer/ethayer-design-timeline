import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { mockGitHubGit, type GitMock } from './github-git-mock.ts';
import { TOKEN } from './github-mock.ts';

/** Spec 004 edit-layer §7 (T393): edit, validate, and publish against a stateful Git Data API. */

const FILE = 'src/content/data/projects/dmns.json';
const dialog = (page: Page): Locator => page.locator('dialog.pd');
const toolbar = (page: Page): Locator => page.getByRole('group', { name: 'Editor' });
const title = (page: Page): Locator => dialog(page).locator('.ed-field[data-pointer="/title"]');
const button = (page: Page, name: string): Locator =>
  toolbar(page).getByRole('button', { name, exact: true });

async function openDmns(page: Page): Promise<GitMock> {
  const git = await mockGitHubGit(page);
  await page.goto('/admin/work/dmns');
  await page.getByLabel('GitHub token').fill(TOKEN);
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(title(page)).toBeVisible();
  // Sign-in's write check posts a probe blob; the specs look at what the editor sends.
  git.writes.length = 0;
  return git;
}

async function editTitle(page: Page, suffix: string): Promise<void> {
  await title(page).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(suffix);
  await expect(toolbar(page).getByText('1 unsaved change')).toBeVisible();
}

const bodyOf = (git: GitMock, method: string, path: RegExp): unknown =>
  git.writes.find((w) => w.method === method && path.test(w.path))?.body;

test.describe('edit and publish (US-E1, US-E2)', () => {
  test('a title edit publishes one commit with the expected bodies, then goes Live', async ({
    page,
  }) => {
    const git = await openDmns(page);
    const before = git.head();
    await editTitle(page, ' v2');
    await button(page, 'Publish').click();
    await expect(toolbar(page).locator('[data-deploy="live"]')).toBeVisible();
    await expect(toolbar(page).getByRole('link', { name: 'View live' })).toHaveAttribute(
      'href',
      '/work/dmns',
    );
    await expect(toolbar(page).getByText('All changes published')).toBeVisible();

    const blob = bodyOf(git, 'POST', /\/git\/blobs$/);
    expect(blob).toMatchObject({ encoding: 'utf-8' });
    expect(JSON.stringify(blob)).toContain('Denver Museum of Nature & Science v2');
    expect(bodyOf(git, 'POST', /\/git\/trees$/)).toMatchObject({
      base_tree: `t${before}`,
      tree: [{ path: FILE, mode: '100644', type: 'blob' }],
    });
    expect(bodyOf(git, 'POST', /\/git\/commits$/)).toMatchObject({
      message: 'content: update dmns via admin\n\nPublished-With: admin editor',
      parents: [before],
    });
    expect(bodyOf(git, 'PATCH', /\/git\/refs\/heads\/main$/)).toEqual({
      sha: git.head(),
      force: false,
    });
    expect(JSON.parse(git.file(FILE) ?? '{}')).toMatchObject({
      title: 'Denver Museum of Nature & Science v2',
    });
  });

  test('an error blocks Publish on its field', async ({ page }) => {
    const git = await openDmns(page);
    await button(page, 'Card settings').click();
    await page.getByLabel('Size').selectOption('sm');
    await expect(toolbar(page).getByText(/\d+ errors?$/)).toBeVisible();
    const publish = button(page, 'Publish');
    await expect(publish).toHaveAttribute('aria-disabled', 'true');
    await expect(publish).toHaveAccessibleDescription(/^Fix \d+ errors? to publish\.$/);
    await expect(page.locator('admin-panel [aria-invalid="true"]').first()).toBeVisible();
    // aria-disabled stays focusable and clickable; a click does nothing (FR-396).
    await publish.dispatchEvent('click');
    expect(git.writes).toEqual([]);
  });

  test('warnings need Publish anyway', async ({ page }) => {
    const git = await openDmns(page);
    await button(page, 'Card settings').click();
    await page.getByLabel('Swiss poster').check();
    await page.getByLabel('Motif').selectOption('drift-bars');
    await expect(toolbar(page).getByText(/warning/)).toBeVisible();
    await button(page, 'Publish').click();
    const confirm = page.getByRole('dialog', { name: /Publish with \d+ warnings?\?/ });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByRole('listitem').first()).toContainText('Warning:');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
    expect(git.writes).toEqual([]);
    await button(page, 'Publish').click();
    await confirm.getByRole('button', { name: 'Publish anyway' }).click();
    await expect(toolbar(page).locator('[data-deploy="live"]')).toBeVisible();
    expect(JSON.parse(git.file(FILE) ?? '{}')).toMatchObject({ treatment: 'swiss' });
  });

  test('a conflict offers Keep my draft, and the next Publish replaces the change', async ({
    page,
  }) => {
    const git = await openDmns(page);
    await editTitle(page, ' mine');
    git.pushElsewhere([FILE]);
    await button(page, 'Publish').click();
    const conflict = page.getByRole('dialog', { name: 'Files changed on GitHub' });
    await expect(conflict.getByRole('listitem')).toHaveText([FILE]);
    await conflict.getByRole('button', { name: 'Keep my draft' }).click();
    await expect(toolbar(page).getByRole('alert')).toContainText('replaces the changes');
    await button(page, 'Publish').click();
    await expect(toolbar(page).locator('[data-deploy="live"]')).toBeVisible();
    expect(JSON.parse(git.file(FILE) ?? '{}')).toMatchObject({
      title: 'Denver Museum of Nature & Science mine',
    });
  });

  test('a reload restores the draft', async ({ page }) => {
    await openDmns(page);
    await editTitle(page, ' kept');
    await page.waitForTimeout(700);
    await page.reload();
    // The token may or may not be remembered (admin-auth "Remember on this device").
    const token = page.getByLabel('GitHub token');
    await expect(token.or(title(page))).toBeVisible();
    if (await token.isVisible()) {
      await token.fill(TOKEN);
      await page.getByRole('button', { name: 'Verify' }).click();
    }
    await expect(title(page)).toHaveText('Denver Museum of Nature & Science kept');
    await expect(toolbar(page).getByText('1 unsaved change')).toBeVisible();
  });
});

test.describe('the panel inside the dialog (FR-388)', () => {
  test('Esc closes only the panel and returns focus to Card settings', async ({ page }) => {
    await openDmns(page);
    await button(page, 'Card settings').click();
    const panel = page.getByRole('complementary', { name: 'Card settings' });
    await expect(panel.getByRole('heading', { name: 'Card settings' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(dialog(page)).toBeVisible();
    await expect(button(page, 'Card settings')).toBeFocused();
  });

  test('Prev and Next keep the panel open on the next project', async ({ page }) => {
    await openDmns(page);
    await button(page, 'Card settings').click();
    const panel = page.getByRole('complementary', { name: 'Card settings' });
    await dialog(page).getByRole('button', { name: /Next/ }).click();
    await expect(page).not.toHaveURL(/\/work\/dmns$/);
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel('Client')).not.toHaveValue('');
    await expect(toolbar(page)).toBeVisible();
  });
});
