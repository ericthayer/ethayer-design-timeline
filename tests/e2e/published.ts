import { readContext, readRawContent } from '../../scripts/content-fs.ts';
import { validateContent } from '../../src/content/validate/index.ts';
import { visibleProjects } from '../../src/core/drafts.ts';

// Playwright loads specs in plain Node, where the projects loader's import.meta.glob doesn't
// exist, so read projects through the validator, as the prerender plugin does (spec 004).
const content = validateContent(readRawContent('.'), readContext('.'));
if (!content.ok) throw new Error('content is invalid: run npm run content:check');

/** The projects production shows, with drafts left out (spec 007, FR-600). */
export const PUBLISHED = visibleProjects(content.value.projects, { includeDrafts: false });

/** Counts in the specs come from content, not a typed number, so a draft change doesn't break them. */
export const PUBLISHED_COUNT = PUBLISHED.length;
