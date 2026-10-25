// One-time migration (spec 004 content-json, FR-315): TS content modules → validated → JSON files
// under src/content/data/, written with `serialize`. Deleted after the migration (T312).
//   node scripts/migrate-content.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { ERAS } from '../src/content/eras.ts';
import { CONTENT_FILES, PROJECTS_DIR, projectFile, serialize } from '../src/content/paths.ts';
import { PROJECTS } from '../src/content/projects/index.ts';
import { RESUME } from '../src/content/resume.ts';
import { SITE } from '../src/content/site.ts';
import { validateContent } from '../src/content/validate/index.ts';
import { readContext } from './content-fs.ts';

const raw: Record<string, unknown> = {
  [CONTENT_FILES.order]: Object.fromEntries(
    ERAS.map((era) => [era.id, PROJECTS.filter((p) => p.era === era.id).map((p) => p.slug)]),
  ),
  [CONTENT_FILES.eras]: ERAS,
  [CONTENT_FILES.site]: SITE,
  [CONTENT_FILES.resume]: RESUME,
};
for (const p of PROJECTS) raw[projectFile(p.slug)] = p;

const result = validateContent(raw, readContext('.'));
for (const i of [...(result.ok ? [] : result.errors), ...result.warnings]) {
  console.log(`${i.severity} ${i.file} ${i.path} ${i.rule}: ${i.message}`);
}
if (!result.ok) process.exit(1);

const { projects, order, eras, site, resume } = result.value;
mkdirSync(PROJECTS_DIR, { recursive: true });
for (const p of projects) writeFileSync(projectFile(p.slug), serialize(p));
writeFileSync(CONTENT_FILES.order, serialize(order));
writeFileSync(CONTENT_FILES.eras, serialize(eras));
writeFileSync(CONTENT_FILES.site, serialize(site));
writeFileSync(CONTENT_FILES.resume, serialize(resume));
console.log(`Wrote ${projects.length} project files and 4 documents to src/content/data/.`);
