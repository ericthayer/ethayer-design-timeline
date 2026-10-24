// Prerendered pages (FR-130–FR-135, US13): head tags, static body, sitemap, redirects.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ERAS } from '../../src/content/eras.ts';
import { PROJECTS } from '../../src/content/projects/index.ts';
import { HOME_DESCRIPTION, HOME_TITLE, projectTitle } from '../../src/content/site.ts';
import type { Project } from '../../src/content/types.ts';
import { Raw, esc, html } from '../../scripts/lib/html.ts';
import { FALLBACK_ORIGIN, resolveOrigin } from '../../scripts/lib/origin.ts';
import {
  applyPage,
  buildPages,
  renderHeadTags,
  renderRedirects,
  renderRobots,
  renderSitemap,
  type MediaManifest,
  type Page,
} from '../../scripts/lib/pages.ts';

const ORIGIN = 'https://example.test';
const manifest = JSON.parse(
  readFileSync('src/content/media-manifest.json', 'utf8'),
) as MediaManifest;
const shell = readFileSync('index.html', 'utf8');
const pages = buildPages({ projects: PROJECTS, eras: ERAS, manifest });

const pageFor = (slug: string): Page => {
  const page = pages.find((p) => p.route === `/work/${slug}`);
  if (!page) throw new Error(`No page for ${slug}`);
  return page;
};
const home = pages[0] as Page;

/** An ampersand that isn't the start of an entity: the mark of unescaped content. */
const BARE_AMPERSAND = /&(?!amp;|lt;|gt;|quot;|#39;)/;

describe('html helper (FR-134)', () => {
  it('escapes interpolations, passes Raw through, flattens arrays, drops empties', () => {
    const nested = html`<i>ok</i>`;
    // prettier-ignore
    const out = html`<p>${'<b>&"\''}</p>${nested}${[1, 'a<']}${null}${false}${undefined}`;
    expect(out.value).toBe('<p>&lt;b&gt;&amp;&quot;&#39;</p><i>ok</i>1a&lt;');
    expect(out).toBeInstanceOf(Raw);
    expect(esc('Tom & "Jerry"')).toBe('Tom &amp; &quot;Jerry&quot;');
  });
});

describe('site origin (FR-132)', () => {
  it.each([
    [{}, FALLBACK_ORIGIN],
    [{ SITE_URL: 'https://work.ethayer.design/' }, 'https://work.ethayer.design'],
    [{ SITE_URL: 'http://localhost:4173' }, 'http://localhost:4173'],
    [{ SITE_URL: 'http://example.test/some/path' }, 'https://example.test'],
    [{ SITE_URL: '  ' }, FALLBACK_ORIGIN],
    [
      { CONTEXT: 'production', URL: 'https://prod.test', DEPLOY_PRIME_URL: 'https://main--x.test' },
      'https://prod.test',
    ],
    [
      {
        CONTEXT: 'deploy-preview',
        URL: 'https://prod.test',
        DEPLOY_PRIME_URL: 'https://pr-7--x.test',
      },
      'https://pr-7--x.test',
    ],
    [
      { SITE_URL: 'https://override.test', CONTEXT: 'production', URL: 'https://prod.test' },
      'https://override.test',
    ],
  ])('resolves %j to %s', (env, expected) => {
    expect(resolveOrigin(env)).toBe(expected);
  });
});

describe('page model', () => {
  it('builds the home page and one page per project, in timeline order', () => {
    expect(pages).toHaveLength(PROJECTS.length + 1);
    expect(home.route).toBe('/');
    expect(home.file).toBe('index.html');
    expect(new Set(pages.map((p) => p.route)).size).toBe(pages.length);
    for (const project of PROJECTS) {
      const page = pageFor(project.slug);
      expect(page.file).toBe(`work/${project.slug}.html`);
      expect(page.meta.title).toBe(projectTitle(project.title));
      expect(page.meta.description).toBe(project.summary);
      expect(page.meta.image).toBe(`/og/${project.slug}.png`);
      expect(page.meta.imageAlt.length).toBeGreaterThan(0);
      expect(page.meta.noindex, project.slug).toBe(project.draft === true);
    }
  });

  it('keeps the shell title and description in step with the constants', () => {
    expect(/<title>([^<]*)<\/title>/.exec(shell)?.[1]).toBe(HOME_TITLE);
    expect(/name="description"\s+content="([^"]*)"/.exec(shell)?.[1]).toBe(HOME_DESCRIPTION);
    expect(home.meta.title).toBe(HOME_TITLE);
  });
});

describe('head tags (FR-131)', () => {
  const dmns = pageFor('dmns');
  const out = applyPage(shell, dmns, ORIGIN);

  it('swaps title and description exactly once and escapes the ampersand', () => {
    expect(out.match(/<title>/g)).toHaveLength(1);
    expect(out).toContain('<title>Denver Museum of Nature &amp; Science — Eric Thayer</title>');
    expect(out.match(/name="description"/g)).toHaveLength(1);
    expect(out).toContain('content="Front-end development and an inclusive pattern library');
  });

  it('adds canonical, Open Graph, and Twitter tags with absolute URLs', () => {
    expect(out).toContain('<link rel="canonical" href="https://example.test/work/dmns" />');
    for (const needle of [
      'property="og:type" content="website"',
      'property="og:site_name" content="Eric Thayer"',
      'property="og:url" content="https://example.test/work/dmns"',
      'property="og:image" content="https://example.test/og/dmns.png"',
      'property="og:image:type" content="image/png"',
      'property="og:image:width" content="1200"',
      'property="og:image:height" content="630"',
      'name="twitter:card" content="summary_large_image"',
      'name="twitter:image" content="https://example.test/og/dmns.png"',
    ]) {
      expect(out, needle).toContain(needle);
    }
    expect(out).toContain(
      'og:image:alt" content="Poster for Denver Museum of Nature &amp; Science',
    );
    expect(out).not.toContain('noindex');
  });

  it('puts the tags before </head> and leaves the app scripts alone', () => {
    expect(out.indexOf('og:title')).toBeLessThan(out.indexOf('</head>'));
    expect(out).toContain('src="/src/main.ts"');
  });

  it('never leaves a bare ampersand in generated head tags', () => {
    for (const page of pages) {
      expect(renderHeadTags(page, ORIGIN), page.route).not.toMatch(BARE_AMPERSAND);
    }
  });

  it('marks drafts noindex and only drafts (FR-135)', () => {
    for (const project of PROJECTS) {
      const tags = renderHeadTags(pageFor(project.slug), ORIGIN);
      expect(tags.includes('name="robots" content="noindex"'), project.slug).toBe(
        project.draft === true,
      );
    }
    expect(renderHeadTags(home, ORIGIN)).not.toContain('noindex');
  });

  it('keeps $ patterns in content literal', () => {
    const tricky: Project = {
      ...(PROJECTS[0] as Project),
      title: "Cost $& $1 $' $$",
      summary: 'A $& B',
    };
    const trickyPages = buildPages({ projects: [tricky], eras: ERAS, manifest });
    const out2 = applyPage(shell, trickyPages[1] as Page, ORIGIN);
    expect(out2).toContain('<title>Cost $&amp; $1 $&#39; $$ — Eric Thayer</title>');
    expect(out2).toContain('content="A $&amp; B"');
  });

  it('fails loudly when the shell changes shape', () => {
    const page = pageFor('dmns');
    expect(() =>
      applyPage(shell.replace(/<noscript>[\s\S]*<\/noscript>/, ''), page, ORIGIN),
    ).toThrow(/<noscript>/);
    expect(() => applyPage(`${shell}<title>two</title>`, page, ORIGIN)).toThrow(/<title>/);
    expect(() =>
      applyPage(shell.replace(/<meta\s+name="description"[^>]*>/, ''), page, ORIGIN),
    ).toThrow(/description/);
  });
});

describe('static content (FR-133)', () => {
  it('gives every project page one h1 and a story, with no bare ampersands', () => {
    for (const project of PROJECTS) {
      const { body } = pageFor(project.slug);
      expect(body.match(/<h1[ >]/g), project.slug).toHaveLength(1);
      expect(body, project.slug).toContain(`>${esc(project.title)}</h1>`);
      for (const heading of ['Context', 'Contribution', 'Outcome']) {
        expect(body, project.slug).toContain(`<h2>${heading}</h2>`);
      }
      expect(body, project.slug).not.toMatch(BARE_AMPERSAND);
      expect(body, project.slug).not.toContain('</noscript>');
    }
  });

  it('links previous, next, and all projects at the right places', () => {
    const first = pageFor('agentic-engineering-loop').body;
    expect(first).not.toContain('Previous:');
    expect(first).toContain('href="/work/cobank-design-system">Next:');
    const last = pageFor('motion-reel').body;
    expect(last).not.toContain('Next:');
    expect(last).toContain('href="/work/dli-training-media">← Previous:');
    expect(last).toContain('<a href="/">All projects</a>');
  });

  it('lists every project on the home page, with an Education target for the skip link', () => {
    for (const project of PROJECTS) {
      expect(home.body, project.slug).toContain(`href="/work/${project.slug}"`);
    }
    expect(home.body.match(/<h1[ >]/g)).toHaveLength(1);
    expect(home.body).toContain('id="timeline-end"');
    expect(home.body).not.toMatch(BARE_AMPERSAND);
  });

  it('only links to internal pages, https, or mailto', () => {
    for (const page of pages) {
      for (const [, href] of page.body.matchAll(/href="([^"]*)"/g)) {
        expect(href, `${page.route} → ${href ?? ''}`).toMatch(/^(\/|https:\/\/|mailto:)/);
      }
    }
  });

  it('shows the draft note only on drafts', () => {
    for (const project of PROJECTS) {
      expect(pageFor(project.slug).body.includes('static__draft'), project.slug).toBe(
        project.draft === true,
      );
    }
  });

  it('includes a sized cover image where the project has one', () => {
    expect(pageFor('dmns').body).toMatch(
      /<img[^>]*src="\/media\/dmns\/cover-960\.webp"[^>]*width="960"/,
    );
    expect(pageFor('agentic-engineering-loop').body).not.toContain('<img');
  });
});

describe('sitemap, robots, redirects (FR-130)', () => {
  it('lists the home page and non-draft projects only', () => {
    const xml = renderSitemap(pages, ORIGIN);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toContain('https://example.test/');
    expect(locs).toHaveLength(1 + PROJECTS.filter((p) => !p.draft).length);
    for (const project of PROJECTS) {
      expect(locs.includes(`https://example.test/work/${project.slug}`), project.slug).toBe(
        !project.draft,
      );
    }
  });

  it('points robots.txt at the sitemap', () => {
    expect(renderRobots(ORIGIN)).toContain('Sitemap: https://example.test/sitemap.xml');
  });

  it('forces one rewrite per project page', () => {
    const lines = renderRedirects(pages).trim().split('\n');
    expect(lines).toHaveLength(PROJECTS.length);
    for (const line of lines) {
      expect(line).toMatch(/^\/work\/([a-z0-9-]+) \/work\/\1\.html 200!$/);
    }
  });
});
