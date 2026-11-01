import siteJson from './data/site.json' with { type: 'json' };
import type { Site } from './types.ts';

/** Identity, contact, and education for the hero and end-cap, from `data/site.json` (FR-303). */
// Validated by content:check (FR-310).
export const SITE = siteJson as Site;

export const HOME_TITLE = 'Eric Thayer — Career Timeline';
export const HOME_DESCRIPTION =
  'Fifteen-plus years of design systems, front-end platforms, and agentic engineering work by Eric Thayer, Principal Design Engineer.';

/** The Projects view's title and description (spec 006, FR-523). */
export const PROJECTS_TITLE = 'Projects — Eric Thayer';
export const PROJECTS_DESCRIPTION =
  'Design systems, agentic engineering, front-end platforms, product design, and motion work by Eric Thayer, grouped by kind of work.';

/** Page title for a project, shared by the dialog and the prerendered head (FR-131). */
export const projectTitle = (title: string): string => `${title} — ${SITE.name}`;
