// The static 404 page (spec 007, FR-620, FR-621).
import { describe, expect, it } from 'vitest';
import { notFoundPage } from '../../scripts/lib/not-found-page.ts';

// The head of a built shell: Vite adds the stylesheet, and the preload and icon come from index.html.
const shell = `<!doctype html>
<html lang="en">
  <head>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="preload" href="/fonts/hanken-grotesk-latin-wght.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" crossorigin href="/assets/index-abc123.css">
    <script type="module" crossorigin src="/assets/index-abc123.js"></script>
  </head>
  <body></body>
</html>`;

const page = notFoundPage(shell);

describe('404 page (FR-620, FR-621)', () => {
  it('is a standalone document with one h1 and noindex', () => {
    expect(page.startsWith('<!doctype html>')).toBe(true);
    expect(page).toContain('<html lang="en">');
    expect(page).toContain('<title>Page not found — Eric Thayer</title>');
    expect(page).toContain('<meta name="robots" content="noindex" />');
    expect(page.match(/<h1[ >]/g)).toHaveLength(1);
    expect(page).toContain('>Page not found</h1>');
  });

  it('links to Experience, Projects, and Résumé', () => {
    for (const [href, label] of [
      ['/', 'Experience'],
      ['/projects', 'Projects'],
      ['/resume', 'Résumé'],
    ]) {
      expect(page).toContain(`<a href="${href}">${label}</a>`);
    }
  });

  it('loads the built stylesheet, preload, and icon, and no JavaScript', () => {
    expect(page).toContain('<link rel="stylesheet" crossorigin href="/assets/index-abc123.css">');
    expect(page).toContain('rel="preload"');
    expect(page).toContain('rel="icon"');
    expect(page).not.toContain('<script');
    expect(page).not.toContain('index-abc123.js');
  });

  it('fails loudly when the shell has no stylesheet', () => {
    expect(() => notFoundPage('<head><title>x</title></head>')).toThrow(/stylesheet/);
  });
});
