import resumeJson from './data/resume.json';
import type { Resume } from './types.ts';

/**
 * HTML résumé (spec 002, FR-120), from `data/resume.json` (spec 004, FR-303). Reached only
 * through dynamic `import()` (FR-122). Identity, links, and education come from SITE. To add the
 * intro video, drop intro.{webm,mp4,vtt} and a poster in public/media/resume/ and add `intro`:
 * `{ src, poster: { kind: 'image', src, alt }, captions: '/media/….vtt', title, durationSec }`.
 */
// Validated by content:check (FR-310).
export const RESUME = resumeJson as Resume;
