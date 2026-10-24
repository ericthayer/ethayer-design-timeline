import siteJson from './data/site.json';
import type { Site } from './types.ts';

/** Identity, contact, and education for the hero and end-cap, from `data/site.json` (FR-303). */
// Validated by content:check (FR-310).
export const SITE = siteJson as Site;

export const HOME_TITLE = 'Eric Thayer — Career Timeline';
export const HOME_DESCRIPTION =
  'Fifteen-plus years of design systems, front-end platforms, and agentic engineering work by Eric Thayer, Principal Design Engineer.';

/** Page title for a project, shared by the dialog and the prerendered head (FR-131). */
export const projectTitle = (title: string): string => `${title} — ${SITE.name}`;
