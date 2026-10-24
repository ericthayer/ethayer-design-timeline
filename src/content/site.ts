import siteJson from './data/site.json';
import type { Site } from './types.ts';

/** Identity, contact, and education for the hero and end-cap, from `data/site.json` (FR-303). */
// Validated by content:check (FR-310).
export const SITE = siteJson as Site;
