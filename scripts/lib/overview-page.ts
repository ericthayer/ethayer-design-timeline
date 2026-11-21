import { CATEGORIES } from '../../src/content/categories.ts';
import type { Era, Project } from '../../src/content/types.ts';
import { html } from './html.ts';

/** Readable production overview for crawlers and visitors without JavaScript (FR-237). */
export function overviewBody(projects: readonly Project[], eras: readonly Era[]): string {
  const selected = ['agentic-engineering-loop', 'drift-detection', 'hs-brand-systems'];
  return html`<div class="static">
    <section class="static__intro" data-theme="indigo-vermilion">
      <p class="static__kicker">Eric Thayer · Denver, CO</p>
      <h1>I build design systems, and the agents that ship them.</h1>
      <p class="static__summary">23 years in UI. Systems used by 120+ designers and developers.</p>
    </section>
    <section id="selected">
      <h2>Selected work</h2>
      <ul class="static__list">
        ${selected.flatMap((slug) => {
          const project = projects.find((p) => p.slug === slug);
          return project
            ? [
                html`<li>
                  <a href="/work/${slug}">${project.title}</a>
                  <p>${project.summary}</p>
                </li>`,
              ]
            : [];
        })}
      </ul>
    </section>
    <section>
      <h2>What I do</h2>
      ${CATEGORIES.map(
        (category) =>
          html`<section>
            <h3>${category.label}</h3>
            <p>${category.description}</p>
            <ul class="static__list">
              ${projects.filter((p) => p.categories[0] === category.id).map((p) => html`<li><a href="/work/${p.slug}">${p.title}</a></li>`)}
            </ul>
          </section>`,
      )}
    </section>
    <section>
      <h2>Career</h2>
      <ul class="static__list">
        ${eras.map((era) => html`<li><a href="/experience#era-${era.id}">${era.label}</a></li>`)}
      </ul>
    </section>
    <p><a href="/resume">Résumé</a> · <a href="/projects">All projects</a></p>
  </div>`.value;
}
