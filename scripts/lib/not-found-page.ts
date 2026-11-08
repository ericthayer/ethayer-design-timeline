/**
 * The static 404 page (spec 007, FR-620, FR-621). Netlify serves `dist/404.html` with status 404 for
 * any path without a page. It's a standalone document: no JavaScript, `noindex`, and the built
 * stylesheet. It doesn't reuse the app shell, because the app would boot and send an unknown path to
 * `/` (plan §2). Erasable TypeScript only: Node runs build scripts that import this without a compiler.
 */
import { SITE } from '../../src/content/site.ts';
import { esc } from './html.ts';

/**
 * The head links the built shell loads for styles, fonts, and the icon. Fails loudly if the shell
 * has no stylesheet, so a changed build can't ship an unstyled 404.
 */
function assetLinks(shell: string): string {
  const links = [...shell.matchAll(/<link\b[^>]*\brel="(?:stylesheet|preload|icon)"[^>]*>/g)].map(
    (match) => match[0],
  );
  if (!links.some((link) => link.includes('rel="stylesheet"'))) {
    throw new Error('Prerender: no stylesheet in the app shell for 404.html');
  }
  return links.join('\n    ');
}

export function notFoundPage(shell: string): string {
  const title = `Page not found — ${SITE.name}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="robots" content="noindex" />
    <meta name="theme-color" content="#121212" />
    ${assetLinks(shell)}
  </head>
  <body>
    <main id="main" class="static" tabindex="-1">
      <section class="static__intro" data-theme="paper-vermilion" aria-labelledby="static-title">
        <p class="static__kicker">404</p>
        <h1 id="static-title">Page not found</h1>
        <p class="static__summary">This address doesn’t match a page on this site. Try one of these instead.</p>
        <ul class="static__links" aria-label="Pages on this site">
          <li><a href="/">Experience</a></li>
          <li><a href="/projects">Projects</a></li>
          <li><a href="/resume">Résumé</a></li>
        </ul>
      </section>
    </main>
  </body>
</html>
`;
}
