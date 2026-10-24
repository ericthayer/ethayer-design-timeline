import { expect, test } from './fixtures.ts';

/** Spec 004 admin-auth US-A4, FR-341, FR-355: public pages never touch admin code or GitHub. */
const PUBLIC_PATHS = ['/', '/work/agentic-engineering-loop', '/resume'];

for (const path of PUBLIC_PATHS) {
  test(`${path} loads no admin chunk and makes no GitHub request`, async ({ page }) => {
    const urls: string[] = [];
    page.on('request', (request) => urls.push(request.url()));
    await page.goto(path);
    await expect(page.locator('timeline-wall')).toBeAttached();
    await page.waitForLoadState('networkidle');
    expect(urls.filter((url) => url.includes('api.github.com'))).toEqual([]);
    expect(urls.filter((url) => /\/assets\/admin-/.test(url))).toEqual([]);
    await expect(page.locator('#admin-island')).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  });
}

test('the public meta CSP blocks a fetch to GitHub', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    'content',
    /connect-src 'self';/,
  );
  const violation = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        document.addEventListener(
          'securitypolicyviolation',
          (event) => {
            resolve(`${event.effectiveDirective} ${event.blockedURI}`);
          },
          { once: true },
        );
        fetch('https://api.github.com/zen').catch(() => undefined);
      }),
  );
  expect(violation).toMatch(/^connect-src https:\/\/api\.github\.com/);
});

test('the public site does not link /admin', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
});
