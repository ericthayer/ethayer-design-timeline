/**
 * The prerendered Projects page (spec 006, FR-523): head tags plus a static, category-grouped
 * list in `<noscript>`. Kept apart from pages.ts, which holds the Experience and project pages.
 * Erasable TypeScript only: Node runs build scripts that import this without a compiler.
 */
import type { Category } from '../../src/content/categories.ts';
import { PROJECTS_OG_SLUG, ogImagePath, projectsOgCard } from '../../src/content/og.ts';
import { PROJECTS_DESCRIPTION, PROJECTS_TITLE, SITE } from '../../src/content/site.ts';
import type { Project, WallItem } from '../../src/content/types.ts';
import { yearRange } from '../../src/core/format.ts';
import { html } from './html.ts';
import type { Page } from './pages.ts';

interface CategoryGroup {
  readonly category: Category;
  readonly projects: Project[];
}

function groupByCategory(items: readonly WallItem[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const item of items) {
    if (item.type === 'category') groups.push({ category: item.category, projects: [] });
    else if (item.type === 'project') groups.at(-1)?.projects.push(item.project);
  }
  return groups;
}

function projectsBody(items: readonly WallItem[], note: string): string {
  return html` <div class="static">
    <section class="static__intro" data-theme="paper-vermilion" aria-labelledby="static-title">
      <p class="static__kicker">${SITE.name} · ${SITE.role}</p>
      <h1 id="static-title">Projects</h1>
      <p class="static__summary">${PROJECTS_DESCRIPTION}</p>
    </section>
    <p class="static__note">${note}</p>
    <section id="wall" aria-label="Projects by category">
      ${groupByCategory(items).map(
        ({ category, projects }) =>
          html` <section class="static__era" aria-labelledby="static-category-${category.id}">
            <h2 id="static-category-${category.id}">${category.label}</h2>
            <p>${category.description}</p>
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
  </div>`.value;
}

export function projectsPage(items: readonly WallItem[], note: string): Page {
  return {
    route: '/projects',
    file: 'projects.html',
    meta: {
      title: PROJECTS_TITLE,
      description: PROJECTS_DESCRIPTION,
      image: ogImagePath(PROJECTS_OG_SLUG),
      imageAlt: projectsOgCard().alt,
    },
    body: projectsBody(items, note),
  };
}
