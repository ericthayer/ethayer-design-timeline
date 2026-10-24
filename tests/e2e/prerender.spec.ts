// Prerendered pages and link previews (US9, FR-100–FR-105) against the built, served output.
import { PROJECTS } from '../../src/content/projects/index.ts';
import { HOME_TITLE } from '../../src/content/site.ts';
import type { Page } from '@playwright/test';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

/**
 * axe can't run while JavaScript is off, so serve the same static markup as live DOM: unwrap the
 * <noscript> and drop the app script. The page then looks exactly as it does with JS disabled.
 */
async function openStaticVersion(page: Page, source: string, path: string): Promise<void> {
  const unwrapped = source
    .replace(/<\/?noscript>/g, '')
    .replace(/<script type="module"[^>]*><\/script>/, '');
  await page.route(
    (url) => url.pathname === path,
    (route) => route.fulfill({ contentType: 'text/html', body: unwrapped }),
  );
  await page.goto(path);
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('a project page shows its story and links onward', async ({ page }) => {
    await page.goto('/work/dmns');
    await expect(page).toHaveTitle('Denver Museum of Nature & Science — Eric Thayer');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Denver Museum of Nature & Science',
    );
    for (const heading of ['Context', 'Contribution', 'Outcome', 'Links']) {
      await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: 'Live build' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Next: SubList Prototype/ })).toHaveAttribute(
      'href',
      '/work/sublist',
    );
    await page.getByRole('link', { name: 'All projects' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('the home page lists every project and ends with education', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Eric Thayer' })).toBeVisible();
    await expect(page.locator('main a[href^="/work/"]')).toHaveCount(28);
    await expect(page.getByRole('heading', { level: 2, name: 'Education' })).toBeVisible();
    await expect(page.locator('#timeline-end')).toHaveCount(1);
    await expect(page.locator('timeline-wall')).toHaveCount(0);
  });
});

test.describe('static content accessibility (FR-103)', () => {
  for (const path of ['/', '/work/agentic-engineering-loop', '/work/dmns', '/work/workbench']) {
    test(`has no axe violations at ${path}`, async ({ page, request }) => {
      const source = await (await request.get(path)).text();
      await openStaticVersion(page, source, path);
      await expect(page.locator('.static')).toBeVisible();
      await expect(page.locator('timeline-wall')).toHaveCount(0);
      await expectNoAxeViolations(page);
    });
  }
});

test.describe('link previews', () => {
  test('the served HTML carries its own social tags before any script runs', async ({
    request,
  }) => {
    const res = await request.get('/work/dmns');
    expect(res.status()).toBe(200);
    const body = await res.text();
    for (const needle of [
      '<title>Denver Museum of Nature &amp; Science — Eric Thayer</title>',
      '<link rel="canonical" href="http://localhost:4173/work/dmns" />',
      'property="og:title" content="Denver Museum of Nature &amp; Science — Eric Thayer"',
      'property="og:image" content="http://localhost:4173/og/dmns.png"',
      'name="twitter:card" content="summary_large_image"',
    ]) {
      expect(body, needle).toContain(needle);
    }
  });

  test('every og:image URL serves a 1200 × 630 PNG', async ({ request }) => {
    for (const path of ['/', ...PROJECTS.map((project) => `/work/${project.slug}`)]) {
      const html = await (await request.get(path)).text();
      const url = /property="og:image" content="([^"]+)"/.exec(html)?.[1];
      if (!url) throw new Error(`${path} has no og:image`);
      const res = await request.get(url);
      expect(res.status(), url).toBe(200);
      expect(res.headers()['content-type'], url).toBe('image/png');
      const bytes = await res.body();
      expect(bytes.subarray(1, 4).toString(), url).toBe('PNG');
      expect(bytes.readUInt32BE(16), url).toBe(1200);
      expect(bytes.readUInt32BE(20), url).toBe(630);
    }
  });

  test('the home page previews as the site, not as a project', async ({ request }) => {
    const body = await (await request.get('/')).text();
    expect(body).toContain(`<title>${HOME_TITLE}</title>`);
    expect(body).toContain('property="og:image" content="http://localhost:4173/og/home.png"');
    expect(body).not.toContain('noindex');
  });

  test('draft pages are noindex and stay out of the sitemap', async ({ request }) => {
    const draft = await (await request.get('/work/workbench')).text();
    expect(draft).toContain('<meta name="robots" content="noindex" />');
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('<loc>http://localhost:4173/work/dmns</loc>');
    expect(sitemap).not.toContain('/work/workbench');
  });

  test('ships robots.txt and forced rewrites for Netlify', async ({ request }) => {
    expect(await (await request.get('/robots.txt')).text()).toContain(
      'Sitemap: http://localhost:4173/sitemap.xml',
    );
    expect(await (await request.get('/_redirects')).text()).toContain(
      '/work/dmns /work/dmns.html 200!',
    );
  });
});

test.describe('with JavaScript', () => {
  test('a prerendered deep link still opens the dialog without showing static content', async ({
    page,
  }) => {
    await page.goto('/work/dmns');
    await expect(
      page.getByRole('dialog', { name: 'Denver Museum of Nature & Science' }),
    ).toBeVisible();
    await expect(page.locator('.static')).toHaveCount(0);
  });

  test('closing a deep-linked dialog restores the home title, not the project title', async ({
    page,
  }) => {
    await page.goto('/work/dmns');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page).toHaveTitle(HOME_TITLE);
  });

  test('an unknown slug still falls back to the app (US5)', async ({ page }) => {
    await page.goto('/work/not-a-project');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Eric Thayer' })).toBeVisible();
  });
});
