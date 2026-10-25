import erasJson from './data/eras.json' with { type: 'json' };
import type { Era } from './types.ts';

/** Career chapters, newest first (data-model §5), from `data/eras.json` (spec 004, FR-303). */
// Validated by content:check (FR-310), which also proves the list is non-empty. A JSON array has
// no tuple type, hence the step through `unknown`.
export const ERAS = erasJson as unknown as readonly [Era, ...Era[]];
