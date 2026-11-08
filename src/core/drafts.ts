import type { Project } from '../content/types.ts';

/**
 * The projects the wall, the dialog, the prerendered pages, and the sitemap show (spec 007,
 * FR-600). Drafts (`draft: true`) are left out unless `includeDrafts` is set. The dev server and
 * `/admin` set it, so drafts can be reviewed there (FR-602). This is a display rule, not a privacy
 * boundary: draft content stays in the repository and the bundle (FR-604).
 */
export function visibleProjects(
  projects: readonly Project[],
  options: { readonly includeDrafts: boolean },
): readonly Project[] {
  return options.includeDrafts ? projects : projects.filter((project) => project.draft !== true);
}
