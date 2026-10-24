import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

/** Every test runs offline: third-party iframes and players are aborted, so posters show. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    await use(page);
  },
});

export { expect };

export async function renderEverything(page: Page): Promise<void> {
  await page.evaluate(() => {
    document
      .querySelector<HTMLElement & { renderAll?: () => void }>('timeline-wall')
      ?.renderAll?.();
  });
}

/** WCAG 2.2 A/AA scan (constitution IV.2). Third-party frames are out of scope. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('iframe')
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary).toEqual([]);
}
