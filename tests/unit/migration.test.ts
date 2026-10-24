// Temporary (spec 004 content-json, FR-317): the generated JSON renders exactly what the TS
// modules did. Deleted with the migration script and the TS data modules (T312, T313).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readContext, readRawContent } from '../../scripts/content-fs.ts';
import { ERAS } from '../../src/content/eras.ts';
import { serialize } from '../../src/content/paths.ts';
import { cobank } from '../../src/content/projects/cobank.ts';
import { earlyCareer } from '../../src/content/projects/early-career.ts';
import { healthScholars } from '../../src/content/projects/health-scholars.ts';
import { independent } from '../../src/content/projects/independent.ts';
import { threecolts } from '../../src/content/projects/threecolts.ts';
import { RESUME } from '../../src/content/resume.ts';
import { SITE } from '../../src/content/site.ts';
import type { Project } from '../../src/content/types.ts';
import { validateContent } from '../../src/content/validate/index.ts';
import { buildWallItems } from '../../src/core/order.ts';

// The legacy TS project modules, in the order the old `projects/index.ts` spread them. ERAS, SITE,
// and RESUME were compared against their TS modules in T307; since T308 those modules load JSON.
const LEGACY_PROJECTS: readonly Project[] = [
  ...cobank,
  ...threecolts,
  ...healthScholars,
  ...independent,
  ...earlyCareer,
];

describe('TS → JSON migration (FR-317)', () => {
  const raw = readRawContent('.');
  const result = validateContent(raw, readContext('.'));

  it('validates with no errors or warnings', () => {
    expect(result.ok ? [] : result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('renders the same wall, eras, site, and résumé as the TS modules', () => {
    if (!result.ok) throw new Error('migrated content is invalid');
    const { projects, eras, site, resume } = result.value;
    expect(projects).toHaveLength(28);
    expect(buildWallItems(projects, eras)).toStrictEqual(buildWallItems(LEGACY_PROJECTS, ERAS));
    expect(eras).toStrictEqual(ERAS);
    expect(site).toStrictEqual(SITE);
    expect(resume).toStrictEqual(RESUME);
  });

  it('is generated output: every file is exactly `serialize` of its parsed value', () => {
    for (const [file, value] of Object.entries(raw)) {
      expect(readFileSync(file, 'utf8'), file).toBe(serialize(value));
    }
  });
});
