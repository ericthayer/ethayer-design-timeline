import orderJson from '../data/order.json';
import type { Project, ProjectOrder } from '../types.ts';

// Validated by content:check (FR-310).
const FILES = import.meta.glob<Project>('../data/projects/*.json', {
  eager: true,
  import: 'default',
});
const ORDER: ProjectOrder = orderJson;

/**
 * One JSON file per project (spec 004, FR-300, FR-303), in `order.json` order: curated within
 * each era (spec A5). Era order comes from ERAS.
 */
export const PROJECTS: readonly Project[] = Object.values(ORDER).flatMap((slugs) =>
  slugs.flatMap((slug) => {
    const project = FILES[`../data/projects/${slug}.json`];
    return project === undefined ? [] : [project];
  }),
);
