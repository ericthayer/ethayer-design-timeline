import type { Locator, Page } from '@playwright/test';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { mockGitHubGit, type GitMock } from './github-git-mock.ts';
import { TOKEN } from './github-mock.ts';

/** Spec 004 edit-layer §7 (T394): create, delete, and axe on every FR-399 state. */

const ORDER = 'src/content/data/order.json';
const dialog = (page: Page): Locator => page.locator('dialog.pd');
const toolbar = (page: Page): Locator => page.getByRole('group', { name: 'Editor' });
const button = (page: Page, name: string): Locator =>
  toolbar(page).getByRole('button', { name, exact: true });
const live = (page: Page): Locator => toolbar(page).locator('[data-deploy="live"]');

async function signIn(page: Page, path: string): Promise<GitMock> {
  const git = await mockGitHubGit(page);
  await page.goto(path);
  await page.getByLabel('GitHub token').fill(TOKEN);
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(toolbar(page)).toBeVisible();
  git.writes.length = 0;
  return git;
}

const bodyOf = (git: GitMock, method: string, path: RegExp): unknown =>
  git.writes.find((w) => w.method === method && path.test(w.path))?.body;

/** Publish, answering "Publish anyway" if the draft has warnings. */
async function publish(page: Page): Promise<void> {
  await button(page, 'Publish').click();
  const anyway = page.getByRole('button', { name: 'Publish anyway' });
  await expect(anyway.or(live(page))).toBeVisible();
  if (await anyway.isVisible()) await anyway.click();
  await expect(live(page)).toBeVisible();
}

test.describe('create (US-E3, FR-393)', () => {
  test('New project previews the draft and publishes its file and order.json', async ({ page }) => {
    const git = await signIn(page, '/admin');
    await button(page, 'New project').click();
    const form = page.getByRole('dialog', { name: 'New project' });
    const slug = form.getByLabel('Slug');
    await expect(slug).toBeFocused();
    await slug.fill('dmns');
    await expect(slug).toHaveAttribute('aria-invalid', 'true');
    await expect(form.getByText('A project named dmns already exists.')).toBeVisible();
    await slug.fill('acme-portal');
    await expect(slug).not.toHaveAttribute('aria-invalid');
    await form.getByLabel('Title').fill('Acme portal');
    await form.getByLabel('Era').selectOption('cobank');
    await form.getByLabel('Client').fill('Acme');
    await form.getByLabel('Role').fill('Lead');
    await form.getByRole('button', { name: 'Create' }).click();

    await expect(page).toHaveURL(/\/admin\/work\/acme-portal$/);
    await expect(dialog(page).locator('[data-pointer="/title"]')).toBeFocused();
    await expect(dialog(page).getByRole('button', { name: /Previous/ })).toBeDisabled();
    await publish(page);

    const tree = bodyOf(git, 'POST', /\/git\/trees$/);
    expect(JSON.stringify(tree)).toContain('src/content/data/projects/acme-portal.json');
    expect(JSON.stringify(tree)).toContain(ORDER);
    expect(bodyOf(git, 'POST', /\/git\/commits$/)).toMatchObject({
      message: 'content: create acme-portal via admin\n\nPublished-With: admin editor',
    });
    expect(
      JSON.parse(git.file('src/content/data/projects/acme-portal.json') ?? '{}'),
    ).toMatchObject({ slug: 'acme-portal', title: 'Acme portal', era: 'cobank', draft: true });
    // The new project goes to index 0 of its era (X4).
    expect(git.file(ORDER)).toMatch(/"cobank": \[\s*"acme-portal",/);
  });
});

test.describe('delete (US-E4, FR-394)', () => {
  test('typing the slug publishes the file, its order entry, and its media folder', async ({
    page,
  }) => {
    const git = await signIn(page, '/admin/work/dmns');
    await button(page, 'Card settings').click();
    await page.getByRole('button', { name: 'Delete project' }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete dmns?' });
    const go = confirm.getByRole('button', { name: 'Delete and publish' });
    await expect(confirm.getByLabel('Type dmns to confirm')).toBeFocused();
    await expect(go).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.type('dmns');
    await expect(go).not.toHaveAttribute('aria-disabled');
    await go.click();
    await expect(dialog(page)).toBeHidden();

    const tree = bodyOf(git, 'POST', /\/git\/trees$/);
    expect(tree).toMatchObject({
      tree: expect.arrayContaining([
        expect.objectContaining({ path: 'src/content/data/projects/dmns.json', sha: null }),
        expect.objectContaining({ path: 'media-src/dmns/cover.png', sha: null }),
        expect.objectContaining({ path: 'media-src/dmns/shot.png', sha: null }),
        expect.objectContaining({ path: ORDER, type: 'blob' }),
      ]),
    });
    expect(bodyOf(git, 'POST', /\/git\/commits$/)).toMatchObject({
      message: 'content: delete dmns via admin\n\nPublished-With: admin editor',
    });
    expect(git.file('src/content/data/projects/dmns.json')).toBeNull();
  });
});

test.describe('axe on every editor state (FR-399)', () => {
  test('dialog, panel, Issues, confirm dialogs, and New project', async ({ page }) => {
    await signIn(page, '/admin/work/dmns');
    await expect(dialog(page).locator('.ed-field').first()).toBeVisible();
    await expectNoAxeViolations(page);

    await button(page, 'Card settings').click();
    await expectNoAxeViolations(page);

    await page.getByLabel('Size').selectOption('sm');
    await toolbar(page)
      .getByRole('button', { name: /^Issues/ })
      .click();
    await expectNoAxeViolations(page);

    await button(page, 'Discard').click();
    await expect(page.getByRole('dialog', { name: /Discard changes/ })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Delete project' }).click();
    await expect(page.getByRole('dialog', { name: 'Delete dmns?' })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');

    await button(page, 'New project').click();
    await expect(page.getByRole('dialog', { name: 'New project' })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
