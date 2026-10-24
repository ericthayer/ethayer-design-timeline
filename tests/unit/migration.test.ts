// Temporary (spec 004 content-json, FR-317): the generated JSON renders exactly what the TS
// modules did. Deleted with the migration script and the TS data modules (T312, T313).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readContext, readRawContent } from '../../scripts/content-fs.ts';
import { ERAS } from '../../src/content/eras.ts';
import { serialize } from '../../src/content/paths.ts';
import { PROJECTS } from '../../src/content/projects/index.ts';
import { RESUME } from '../../src/content/resume.ts';
import { SITE } from '../../src/content/site.ts';
import { validateContent } from '../../src/content/validate/index.ts';
import { buildWallItems } from '../../src/core/order.ts';

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
    expect(buildWallItems(projects, eras)).toStrictEqual(buildWallItems(PROJECTS, ERAS));
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
