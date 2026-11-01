import type { Category } from '../content/categories.ts';
import type { Era, Project, WallItem } from '../content/types.ts';

/**
 * Projects → render list (FR-001): each era newest first with its
 * projects in curated order, then the end-cap. Eras without projects are skipped.
 */
export function buildWallItems(projects: readonly Project[], eras: readonly Era[]): WallItem[] {
  const sortedEras = [...eras].sort((a, b) => b.period.start.localeCompare(a.period.start));
  const sequence = sortedEras.flatMap((era) => projects.filter((p) => p.era === era.id));
  const total = sequence.length;
  const items: WallItem[] = [];
  let index = 0;
  for (const era of sortedEras) {
    const inEra = projects.filter((p) => p.era === era.id);
    if (inEra.length === 0) continue;
    items.push({ type: 'era', era });
    for (const project of inEra) {
      index += 1;
      items.push({ type: 'project', project, index, total });
    }
  }
  items.push({ type: 'end-cap' });
  return items;
}

/**
 * Projects view (spec 006, FR-510, FR-503): a marker per category, then the projects whose
 * primary category it is, in Experience order. Every project appears once. Empty categories
 * are skipped, and there is no end-cap (FR-512).
 */
export function buildCategoryItems(
  projects: readonly Project[],
  eras: readonly Era[],
  categories: readonly Category[],
): WallItem[] {
  const sequence = projectSequence(buildWallItems(projects, eras));
  const total = sequence.length;
  const items: WallItem[] = [];
  let index = 0;
  for (const category of categories) {
    const inCategory = sequence.filter((p) => p.categories[0] === category.id);
    if (inCategory.length === 0) continue;
    items.push({ type: 'category', category, count: inCategory.length });
    for (const project of inCategory) {
      index += 1;
      items.push({ type: 'project', project, index, total });
    }
  }
  return items;
}

/** Project order used by the dialog's Prev/Next (FR-055). */
export function projectSequence(items: readonly WallItem[]): Project[] {
  return items.flatMap((item) => (item.type === 'project' ? [item.project] : []));
}

/** Index in `items` of a project's wall item, or -1. */
export function itemIndexOf(items: readonly WallItem[], slug: string): number {
  return items.findIndex((item) => item.type === 'project' && item.project.slug === slug);
}
