// The prerendered /resume page (spec 007, FR-615–FR-617).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SITE, RESUME_TITLE } from '../../src/content/site.ts';
import { RESUME } from '../../src/content/resume.ts';
import { esc } from '../../scripts/lib/html.ts';
import { applyPage } from '../../scripts/lib/pages.ts';
import { resumePage } from '../../scripts/lib/resume-page.ts';

const ORIGIN = 'https://example.test';
const shell = readFileSync('index.html', 'utf8');
const page = resumePage(RESUME);
const BARE_AMPERSAND = /&(?!amp;|lt;|gt;|quot;|#39;)/;

describe('/resume page model (FR-615, FR-616)', () => {
  it('is served at /resume as resume.html with the résumé title and the home image', () => {
    expect(page).toMatchObject({
      route: '/resume',
      file: 'resume.html',
      meta: { title: RESUME_TITLE, image: '/og/home.png' },
    });
    expect(page.meta.description).toBe(RESUME.summary);
    expect(page.meta.imageAlt.length).toBeGreaterThan(0);
  });

  it('is a single h1 with every experience role, skill, and project', () => {
    expect(page.body.match(/<h1[ >]/g)).toHaveLength(1);
    expect(page.body).toContain(`>${esc(SITE.name)}</h1>`);
    for (const role of RESUME.experience) {
      expect(page.body, role.role).toContain(`<h3>${esc(role.role)}</h3>`);
      expect(page.body, role.company).toContain(esc(role.company));
    }
    for (const skill of RESUME.skills) expect(page.body, skill).toContain(`<li>${esc(skill)}</li>`);
    for (const project of RESUME.projects) {
      expect(page.body, project.title).toContain(esc(project.title));
    }
    for (const heading of ['Experience', 'Skills', 'Development', 'Software', 'Education']) {
      expect(page.body, heading).toContain(`<h2>${heading}</h2>`);
    }
  });

  it('escapes content from resume.json, with no bare ampersands', () => {
    const tricky = resumePage({ ...RESUME, headline: 'R&D <lead> "quoted"' });
    expect(tricky.body).toContain('R&amp;D &lt;lead&gt; &quot;quoted&quot;');
    expect(page.body).not.toMatch(BARE_AMPERSAND);
    expect(page.body).not.toContain('<script');
  });

  it('does not link to /resume itself, and marks external links as opening a new tab', () => {
    expect(page.body).not.toContain('href="/resume"');
    const external = [...page.body.matchAll(/<a [^>]*href="https:[^>]*>/g)].map((m) => m[0]);
    expect(external.length).toBeGreaterThan(0);
    for (const tag of external) {
      expect(tag, tag).toContain('rel="noopener noreferrer"');
      expect(tag, tag).toContain('target="_blank"');
    }
  });
});

describe('/resume head and noscript (FR-615, FR-617)', () => {
  const out = applyPage(shell, page, ORIGIN);

  it('gives the page its own canonical URL and social tags, and no noindex', () => {
    expect(out).toContain('<link rel="canonical" href="https://example.test/resume" />');
    expect(out).toContain(`<title>${RESUME_TITLE}</title>`);
    expect(out).toContain('property="og:image" content="https://example.test/og/home.png"');
    expect(out).not.toContain('noindex');
  });

  it('places the full résumé inside <noscript>, once', () => {
    const block = /<noscript>([\s\S]*?)<\/noscript>/.exec(out);
    expect(block?.[1]).toContain('<h2>Experience</h2>');
    expect(out.match(/<noscript>/g)).toHaveLength(1);
  });
});
