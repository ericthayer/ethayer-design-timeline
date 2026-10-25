import type { Era, Project, WallItem } from '../content/types.ts';

/**
 * Projects → render list (FR-001): each era newest first with its
 * projects in curated order, then the end-cap. Eras without projects are skipped.
 * The Education tile closes the first era, near the start of the wall (FR-074).
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
    if (!items.some((item) => item.type === 'education')) items.push({ type: 'education' });
  }
  items.push({ type: 'end-cap' });
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
