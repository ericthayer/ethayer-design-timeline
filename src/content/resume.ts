import resumeJson from './data/resume.json';
import type { Resume } from './types.ts';

/**
 * HTML résumé (spec 002, FR-120), from `data/resume.json` (spec 004, FR-303). Reached only
 * through dynamic `import()` (FR-122). Identity, links, and education come from SITE. To add the
 * intro video: put intro.{webm,mp4} and a poster image in media-src/resume/, the captions file in
 * public/captions/, then add `intro` to data/resume.json:
 * `{ src: 'resume/intro', poster: { kind: 'image', src: 'resume/<poster>', alt }, captions:
 * '/captions/resume-intro.vtt', title, durationSec }`.
 */
// Validated by content:check (FR-310).
export const RESUME = resumeJson as Resume;
