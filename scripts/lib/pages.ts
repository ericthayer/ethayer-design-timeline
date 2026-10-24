/**
 * Prerendered pages (FR-100–FR-105): per-route head tags and static `<noscript>` content, applied
 * to the built app shell. Pure functions, so unit tests cover them without a build.
 */
import { HOME_OG_SLUG, OG_SIZE, homeOgCard, ogCardFor, ogImagePath } from '../../src/content/og.ts';
import { HOME_DESCRIPTION, HOME_TITLE, SITE, projectTitle } from '../../src/content/site.ts';
import type { Era, ImageMedia, Project, WallItem } from '../../src/content/types.ts';
import { yearRange } from '../../src/core/format.ts';
import { buildWallItems, projectSequence } from '../../src/core/order.ts';
import { Raw, esc, html } from './html.ts';

export interface MediaManifestEntry {
  readonly width: number;
  readonly height: number;
  readonly widths: readonly number[];
}
export type MediaManifest = Readonly<Record<string, MediaManifestEntry | undefined>>;

export interface PageMeta {
  readonly title: string;
  readonly description: string;
  readonly image: string;
  readonly imageAlt: string;
  readonly noindex: boolean;
}

export interface Page {
  readonly route: string;
  /** Path inside the build output, e.g. 'work/dmns.html'. */
  readonly file: string;
  readonly meta: PageMeta;
  /** Inner HTML of the `<noscript>` block in `<main>` (FR-103). */
  readonly body: string;
}

export interface BuildInput {
  readonly projects: readonly Project[];
  readonly eras: readonly Era[];
  readonly manifest: MediaManifest;
}

const NOTE =
  'The interactive timeline needs JavaScript. This is the static version of the same page.';

function coverOf(project: Project): ImageMedia | undefined {
  const { media } = project;
  if (media.kind === 'image') return media;
  if (media.kind === 'video' || media.kind === 'iframe') return media.poster;
  return undefined;
}

function coverImage(project: Project, manifest: MediaManifest): Raw | null {
  const media = coverOf(project);
  const entry = media ? manifest[media.src] : undefined;
  const width = entry?.widths.find((w) => w >= 960) ?? entry?.widths.at(-1);
  if (!media || !entry || width === undefined) return null;
  const height = Math.round((width * entry.height) / entry.width);
  return html`<img
    class="static__cover"
    src="/media/${media.src}-${width}.webp"
    alt="${media.alt}"
    width="${width}"
    height="${height}"
  />`;
}

interface EraGroup {
  readonly era: Era;
  readonly projects: Project[];
}

function groupByEra(items: readonly WallItem[]): EraGroup[] {
  const groups: EraGroup[] = [];
  for (const item of items) {
    if (item.type === 'era') groups.push({ era: item.era, projects: [] });
    else if (item.type === 'project') groups.at(-1)?.projects.push(item.project);
  }
  return groups;
}

function homeBody(items: readonly WallItem[]): string {
  return html` <div class="static">
    <section class="static__intro" data-theme="paper-vermilion" aria-labelledby="static-title">
      <p class="static__kicker">${SITE.role} · ${SITE.location}</p>
      <h1 id="static-title">${SITE.name}</h1>
      <p class="static__summary">${SITE.summary}</p>
      <ul class="static__links" aria-label="Contact and profiles">
        ${SITE.links.map((link) => html`<li><a href="${link.href}">${link.label}</a></li>`)}
      </ul>
    </section>
    <p class="static__note">${NOTE}</p>
    <section id="wall" aria-labelledby="static-projects">
      <h2 id="static-projects">Projects</h2>
      ${groupByEra(items).map(
        ({ era, projects }) =>
          html` <section class="static__era" aria-labelledby="static-era-${era.id}">
            <h3 id="static-era-${era.id}">
              ${era.label} <span class="static__meta">${yearRange(era.period)}</span>
            </h3>
            <ol class="static__list">
              ${projects.map(
                (project) =>
                  html` <li>
                    <a href="/work/${project.slug}">${project.title}</a>
                    <span class="static__meta"
                      >${project.client} · ${yearRange(project.period)}</span
                    >
                    <p>${project.summary}</p>
                  </li>`,
              )}
            </ol>
          </section>`,
      )}
    </section>
    <section id="timeline-end" tabindex="-1" aria-labelledby="static-education">
      <h2 id="static-education">Education</h2>
      <ul class="static__list">
        ${SITE.education.map(
          (item) => html`<li><strong>${item.year}</strong> ${item.degree}, ${item.school}</li>`,
        )}
      </ul>
    </section>
  </div>`.value;
}

interface Neighbors {
  readonly prev: Project | undefined;
  readonly next: Project | undefined;
}

function projectBody(project: Project, near: Neighbors, manifest: MediaManifest): string {
  const years = yearRange(project.period);
  const story: [string, string][] = [
    ['Context', project.body.context],
    ['Contribution', project.body.contribution],
    ['Outcome', project.body.outcome],
  ];
  return html` <div class="static">
    <p class="static__note">${NOTE}</p>
    <article id="wall" aria-labelledby="static-title">
      <header class="static__head" data-theme="${project.theme}">
        <p class="static__kicker">${project.client} · ${years}</p>
        <h1 id="static-title">${project.title}</h1>
      </header>
      ${coverImage(project, manifest)}
      <p class="static__summary">${project.summary}</p>
      <dl class="static__facts">
        <div>
          <dt>Role</dt>
          <dd>${project.role}</dd>
        </div>
        <div>
          <dt>Period</dt>
          <dd>${years}</dd>
        </div>
      </dl>
      <div class="static__story">
        ${story.map(
          ([heading, text]) =>
            html`<h2>${heading}</h2>
              <p>${text}</p>`,
        )}
      </div>
      ${
        project.metrics?.length
          ? html`<h2>Results</h2>
              <ul class="static__list">
                ${project.metrics.map(
                  (metric) =>
                    html`<li>
                      <strong>${metric.value}</strong> ${metric.label}${
                        metric.baseline && metric.result
                          ? html` <span class="static__meta"
                              >(${metric.baseline} → ${metric.result})</span
                            >`
                          : null
                      }
                    </li>`,
                )}
              </ul>`
          : null
      }
      ${
        project.links?.length
          ? html`<h2>Links</h2>
              <ul class="static__links">
                ${project.links.map((link) => html`<li><a href="${link.href}">${link.label}</a></li>`)}
              </ul>`
          : null
      }
      ${project.draft ? html`<p class="static__draft">Draft copy and placeholder media. Final details pending.</p>` : null}
    </article>
    <nav class="static__nav" aria-label="Project navigation">
      <ul class="static__links">
        <li><a href="/">All projects</a></li>
        ${near.prev ? html`<li><a href="/work/${near.prev.slug}">← Previous: ${near.prev.title}</a></li>` : null}
        ${near.next ? html`<li><a href="/work/${near.next.slug}">Next: ${near.next.title} →</a></li>` : null}
      </ul>
    </nav>
  </div>`.value;
}

/** Home first, then one page per project in timeline order. */
export function buildPages(input: BuildInput): Page[] {
  const items = buildWallItems(input.projects, input.eras);
  const sequence = projectSequence(items);
  const home: Page = {
    route: '/',
    file: 'index.html',
    meta: {
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      image: ogImagePath(HOME_OG_SLUG),
      imageAlt: homeOgCard().alt,
      noindex: false,
    },
    body: homeBody(items),
  };
  const projects = sequence.map((project, index): Page => ({
    route: `/work/${project.slug}`,
    file: `work/${project.slug}.html`,
    meta: {
      title: projectTitle(project.title),
      description: project.summary,
      image: ogImagePath(project.slug),
      imageAlt: ogCardFor(project).alt,
      noindex: project.draft === true,
    },
    body: projectBody(
      project,
      { prev: sequence[index - 1], next: sequence[index + 1] },
      input.manifest,
    ),
  }));
  return [home, ...projects];
}

/** Canonical, robots, Open Graph, and Twitter tags for one page (FR-101). */
export function renderHeadTags(page: Page, origin: string): string {
  const { meta } = page;
  const url = `${origin}${page.route}`;
  const image = `${origin}${meta.image}`;
  const tags: Raw[] = [
    html`<link rel="canonical" href="${url}" />`,
    ...(meta.noindex ? [html`<meta name="robots" content="noindex" />`] : []),
    html`<meta property="og:type" content="website" />`,
    html`<meta property="og:site_name" content="${SITE.name}" />`,
    html`<meta property="og:title" content="${meta.title}" />`,
    html`<meta property="og:description" content="${meta.description}" />`,
    html`<meta property="og:url" content="${url}" />`,
    html`<meta property="og:image" content="${image}" />`,
    html`<meta property="og:image:type" content="image/png" />`,
    html`<meta property="og:image:width" content="${OG_SIZE.width}" />`,
    html`<meta property="og:image:height" content="${OG_SIZE.height}" />`,
    html`<meta property="og:image:alt" content="${meta.imageAlt}" />`,
    html`<meta name="twitter:card" content="summary_large_image" />`,
    html`<meta name="twitter:title" content="${meta.title}" />`,
    html`<meta name="twitter:description" content="${meta.description}" />`,
    html`<meta name="twitter:image" content="${image}" />`,
    html`<meta name="twitter:image:alt" content="${meta.imageAlt}" />`,
  ];
  return tags.map((tag) => `    ${tag.value}`).join('\n');
}

/** Replace exactly one match, or fail loudly so a changed shell can't ship half-processed. */
function swapOnce(source: string, pattern: RegExp, replacement: string, label: string): string {
  const count = [...source.matchAll(new RegExp(pattern.source, 'g'))].length;
  if (count !== 1)
    throw new Error(`Prerender: expected one ${label} in the app shell, found ${count}`);
  // A function replacement keeps `$&`, `$1` and friends in content from being interpreted.
  return source.replace(pattern, () => replacement);
}

/** Turn the built app shell into one route's page. */
export function applyPage(shell: string, page: Page, origin: string): string {
  let out = shell;
  out = swapOnce(out, /<title>[^<]*<\/title>/, `<title>${esc(page.meta.title)}</title>`, '<title>');
  out = swapOnce(
    out,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${esc(page.meta.description)}" />`,
    'meta description',
  );
  out = swapOnce(
    out,
    /<noscript>[\s\S]*?<\/noscript>/,
    `<noscript>${page.body}\n      </noscript>`,
    '<noscript>',
  );
  out = swapOnce(out, /\s*<\/head>/, `\n${renderHeadTags(page, origin)}\n  </head>`, '</head>');
  return out;
}

const loc = (page: Page, origin: string): string => `${origin}${page.route}`;

export function renderSitemap(pages: readonly Page[], origin: string): string {
  const urls = pages
    .filter((page) => !page.meta.noindex)
    .map((page) => `  <url><loc>${esc(loc(page, origin))}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderRobots(origin: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}

/** Forced rewrites (the trailing `!`) so a static page always beats the wildcard fallback (FR-100). */
export function renderRedirects(pages: readonly Page[]): string {
  return `${pages
    .filter((page) => page.route !== '/')
    .map((page) => `${page.route} /${page.file} 200!`)
    .join('\n')}\n`;
}
