/**
 * The prerendered `/resume` page (spec 007, FR-615–FR-617). The résumé goes in `<noscript>`, as on
 * the other prerendered pages, built from resume.json through the escaping helper. A visitor
 * without JavaScript reads the same content the dialog shows. Its social image is the home card.
 * Erasable TypeScript only: Node runs build scripts that import this without a compiler.
 */
import { HOME_OG_SLUG, homeOgCard, ogImagePath } from '../../src/content/og.ts';
import { RESUME_TITLE, SITE } from '../../src/content/site.ts';
import type { Resume, ResumeProject, ResumeRole } from '../../src/content/types.ts';
import { periodText } from '../../src/core/format.ts';
import { Raw, html } from './html.ts';
import type { Page } from './pages.ts';

/** An external link, marked as opening in a new tab, the same as the dialog's (FR-125). */
const external = (href: string, label: string): Raw =>
  html`<a href="${href}" target="_blank" rel="noopener noreferrer"
    >${label}<span class="visually-hidden"> (opens in a new tab)</span></a
  >`;

const role = (item: ResumeRole): Raw =>
  html`<li>
    <h3>${item.role}</h3>
    <p class="static__meta">
      ${item.href ? external(item.href, item.company) : item.company} · ${item.location} ·
      ${periodText(item.period)}
    </p>
    <p>${item.summary}</p>
    ${
      item.highlights.length
        ? html`<ul>
            ${item.highlights.map((h) => html`<li>${h}</li>`)}
          </ul>`
        : null
    }
  </li>`;

const project = (item: ResumeProject): Raw =>
  html`<li>
    <strong>${item.href ? external(item.href, item.title) : item.title}</strong>
    <span class="static__meta">${item.detail} · ${item.year}</span>
  </li>`;

const tags = (items: readonly string[]): Raw =>
  html`<ul class="static__list">
    ${items.map((item) => html`<li>${item}</li>`)}
  </ul>`;

/** Contact and profile links from site.json; `/resume` itself is left out (FR-124). */
const contactLinks = (): Raw[] =>
  SITE.links
    .filter((link) => link.href !== '/resume')
    .map(
      (link) =>
        html`<li>
          ${link.href.startsWith('https:') ? external(link.href, link.label) : html`<a href="${link.href}">${link.label}</a>`}
        </li>`,
    );

export function resumePage(resume: Resume): Page {
  const body = html`<div class="static">
    <section class="static__intro" data-theme="plum-ember" aria-labelledby="static-title">
      <p class="static__kicker">${SITE.role} · ${SITE.location}</p>
      <h1 id="static-title">${SITE.name}</h1>
      <p class="static__summary">${resume.headline}</p>
      <p>${resume.summary}</p>
      <ul class="static__links" aria-label="Contact and profiles">
        ${contactLinks()}
      </ul>
    </section>
    <h2>Experience</h2>
    <ol class="static__list">
      ${resume.experience.map(role)}
    </ol>
    <h2>Skills</h2>
    ${tags(resume.skills)}
    <h2>Development</h2>
    ${tags(resume.proficiencies.development)}
    <h2>Software</h2>
    ${tags(resume.proficiencies.software)}
    <h2>Education</h2>
    <ul class="static__list">
      ${SITE.education.map(
        (e) => html`<li><strong>${e.year}</strong> ${e.degree}, ${e.school}</li>`,
      )}
    </ul>
    <h2>Selected projects</h2>
    <ul class="static__list">
      ${resume.projects.map(project)}
    </ul>
  </div>`.value;
  const home = homeOgCard();
  return {
    route: '/resume',
    file: 'resume.html',
    meta: {
      title: RESUME_TITLE,
      description: resume.summary,
      image: ogImagePath(HOME_OG_SLUG),
      imageAlt: home.alt,
    },
    body,
  };
}
