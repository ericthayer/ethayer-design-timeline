import type { Locator, Page } from '@playwright/test';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { captureSession, mockGitHub, SCENARIOS, TOKEN, type Scenario } from './github-mock.ts';

/** Spec 004 admin-auth §6: /admin with GitHub mocked by route interception. */

const field = (page: Page): Locator => page.getByLabel('GitHub token');
const island = (page: Page): Locator => page.getByRole('complementary', { name: 'Admin' });
const wall = (page: Page): Locator => page.getByRole('region', { name: 'Career timeline' });

async function signIn(page: Page, token = TOKEN): Promise<void> {
  await field(page).fill(token);
  await page.getByRole('button', { name: 'Verify' }).click();
}

async function expectSignedIn(page: Page): Promise<void> {
  await expect(island(page).getByRole('status')).toHaveText('Signed in as ericthayer');
  await expect(wall(page)).toBeVisible();
}

test.describe('/admin sign-in (US-A1)', () => {
  test('empty state shows the header, steps, and a labeled field', async ({ page }) => {
    await mockGitHub(page);
    await page.goto('/admin');
    await expect(page).toHaveTitle('Admin — Eric Thayer');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to edit' })).toBeVisible();
    const link = page.getByRole('link', { name: /Create a fine-grained token on GitHub/ });
    await expect(link).toHaveAttribute(
      'href',
      'https://github.com/settings/personal-access-tokens/new',
    );
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(page.getByText('Contents: Read and write')).toBeVisible();
    await expect(page.getByText('Commit statuses: Read-only')).toBeVisible();
    await expect(field(page)).toHaveAttribute('type', 'password');
    await expect(wall(page)).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test('Show token toggles the field and aria-pressed', async ({ page }) => {
    await mockGitHub(page);
    await page.goto('/admin');
    const toggle = page.getByRole('button', { name: 'Show token' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(field(page)).toHaveAttribute('type', 'text');
  });

  test('a valid token boots the wall, focuses <main>, and leaves no token behind', async ({
    page,
  }) => {
    const console: string[] = [];
    page.on('console', (message) => console.push(message.text()));
    const nonGitHubAuth: string[] = [];
    page.on('request', (request) => {
      if (
        !request.url().startsWith('https://api.github.com/') &&
        request.headers()['authorization']
      )
        nonGitHubAuth.push(request.url());
    });
    const github = await mockGitHub(page);
    await page.goto('/admin');
    await signIn(page);
    await expectSignedIn(page);
    await expect(page.locator('#main')).toBeFocused();
    await expect(page.locator('[data-admin-slot="toolbar"]')).toBeAttached();

    expect(github.requests.map((r) => new URL(r.url()).pathname).sort()).toEqual([
      '/repos/ericthayer/ethayer-design-timeline',
      '/user',
    ]);
    for (const request of github.requests) {
      expect(request.headers()['authorization']).toBe(`Bearer ${TOKEN}`);
      expect(request.headers()['x-github-api-version']).toBe('2022-11-28');
    }
    expect(nonGitHubAuth).toEqual([]);
    expect(page.url()).not.toContain(TOKEN);
    expect(console.join('\n')).not.toContain(TOKEN);
    expect(await page.content()).not.toContain(TOKEN);
    await expectNoAxeViolations(page);
  });

  const failures: [string, Scenario, RegExp][] = [
    ['bad-token', SCENARIOS.badToken, /mistyped, revoked, or expired/],
    ['wrong-account', SCENARIOS.wrongAccount, /different GitHub account/],
    ['wrong-repo', SCENARIOS.wrongRepo, /can't see the ethayer-design-timeline repository/],
    ['read-only', SCENARIOS.readOnly, /Set Contents to Read and write/],
    ['rate-limited', SCENARIOS.rateLimited, /Try again in 2 minutes/],
    ['network', SCENARIOS.network, /Couldn't reach GitHub/],
    ['github-error', SCENARIOS.githubError, /unexpected error/],
  ];
  for (const [kind, scenario, message] of failures) {
    test(`${kind}: names the fix, marks the field, and returns focus to it`, async ({ page }) => {
      await mockGitHub(page, scenario);
      await page.goto('/admin');
      await signIn(page);
      await expect(page.getByText(message)).toBeVisible();
      await expect(field(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(field(page)).toBeFocused();
      await expect(wall(page)).toHaveCount(0);
      expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
      if (kind === 'read-only') await expectNoAxeViolations(page);
    });
  }

  test('refuses a classic token before contacting GitHub', async ({ page }) => {
    const github = await mockGitHub(page);
    await page.goto('/admin');
    await signIn(page, 'ghp_classicTokenValue');
    await expect(page.getByText(/Classic tokens \(ghp_\) aren't accepted/)).toBeVisible();
    expect(github.requests).toHaveLength(0);
  });
});

test.describe('/admin session (US-A2, US-A3, US-A5, US-A6)', () => {
  test('reload re-verifies the stored token and boots without pasting', async ({ page }) => {
    const github = await mockGitHub(page);
    await page.goto('/admin');
    await signIn(page);
    await expectSignedIn(page);
    await page.reload();
    await expectSignedIn(page);
    expect(github.requests.filter((r) => r.url().endsWith('/user'))).toHaveLength(2);
  });

  test('a stored token that stopped working is cleared and explained', async ({ page }) => {
    const github = await mockGitHub(page);
    await page.goto('/admin');
    await signIn(page);
    await expectSignedIn(page);
    github.use(SCENARIOS.badToken);
    await page.reload();
    await expect(page.getByText(/mistyped, revoked, or expired/)).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  });

  test('Sign out erases the token and returns to the sign-in panel', async ({ page }) => {
    await mockGitHub(page);
    await page.goto('/admin/work/cobank-design-system');
    await signIn(page);
    await expect(island(page).getByRole('status')).toHaveText('Signed in as ericthayer');
    await page.keyboard.press('Escape');
    await island(page).getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to edit' })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  });

  test('deep link opens after sign-in and navigation keeps the /admin prefix', async ({ page }) => {
    await mockGitHub(page);
    await page.goto('/admin/work/agentic-engineering-loop');
    await signIn(page);
    const dialog = page.getByRole('dialog', { name: 'Agentic Engineering Loop' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^Next: / }).click();
    await expect(page).toHaveURL(/\/admin\/work\/cobank-design-system$/);
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole('link', { name: 'Agentic Engineering Loop' }).click();
    await expect(page).toHaveURL(/\/admin\/work\/agentic-engineering-loop$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole('banner').getByRole('link', { name: 'Résumé' }).click();
    await expect(page).toHaveURL(/\/admin\/resume$/);
  });

  test('a 401 mid-session opens re-auth; Esc offers Sign in again; signing in resumes', async ({
    page,
  }) => {
    await captureSession(page);
    const github = await mockGitHub(page);
    await page.goto('/admin');
    await signIn(page);
    await expectSignedIn(page);

    github.use(SCENARIOS.badToken);
    const status = await page.evaluate(async () => {
      const session = (
        window as unknown as {
          __adminSession: { authorizedFetch(path: string): Promise<Response> };
        }
      ).__adminSession;
      return (await session.authorizedFetch('/user')).status;
    });
    expect(status).toBe(401);
    const reauth = page.getByRole('dialog', { name: 'Sign in again' });
    await expect(reauth).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
    await expectNoAxeViolations(page);

    await page.keyboard.press('Escape');
    await expect(reauth).toBeHidden();
    const again = island(page).getByRole('button', { name: 'Sign in again' });
    await expect(again).toBeVisible();
    await again.click();

    github.use(SCENARIOS.ok);
    await reauth.getByLabel('GitHub token').fill(TOKEN);
    await reauth.getByRole('button', { name: 'Verify' }).click();
    await expect(reauth).toBeHidden();
    await expect(island(page).getByRole('status')).toHaveText('Signed in as ericthayer');
    await expect(wall(page)).toBeVisible();
  });
});
