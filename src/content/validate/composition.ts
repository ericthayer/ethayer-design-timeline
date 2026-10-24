// Bundle rules (spec 004 content-json, FR-301, FR-312, FR-313): `order` integrity, the
// `era` ↔ key match, and the editorial warnings `swiss-share`, `standard-run`, `swiss-motif-unique`.
import { buildWallItems, projectSequence } from '../../core/order.ts';
import { CONTENT_FILES, projectFile, slugOfFile } from '../paths.ts';
import type { Project, ProjectOrder, Resume, Site } from '../types.ts';
import {
  type Eras,
  validateEras,
  validateOrder,
  validateResume,
  validateSite,
} from './documents.ts';
import {
  type Issue,
  JsonParseFailure,
  type RawContent,
  type ValidationContext,
  type Validated,
  finish,
  issue,
  pointer,
} from './issue.ts';
import { validateProject } from './project.ts';

/** Everything the public site renders, after validation (FR-305). */
export interface ContentBundle {
  /** In `order.json` order: era keys as listed, then each era's curated slugs. */
  readonly projects: readonly Project[];
  readonly order: ProjectOrder;
  readonly eras: Eras;
  readonly site: Site;
  readonly resume: Resume;
}

/** FR-011b: Swiss share 20–30 %, and no more than 7 standard cards in a row. */
const SWISS_SHARE = { min: 0.2, max: 0.3 } as const;
const MAX_STANDARD_RUN = 7;

function collect<T>(result: Validated<T>, issues: Issue[]): T | undefined {
  issues.push(...(result.ok ? [] : result.errors), ...result.warnings);
  return result.ok ? result.value : undefined;
}

/** A required document: `undefined` (with an issue) when it is missing or unparsable. */
function documentOf(raw: RawContent, file: string, issues: Issue[]): unknown {
  if (!Object.hasOwn(raw, file)) {
    issues.push(issue('shape', file, '', null, `${file} is missing`));
    return undefined;
  }
  const value = raw[file];
  return value instanceof JsonParseFailure ? undefined : value;
}

/** Every project file is listed exactly once, under its own era; every listed slug has a file. */
function checkOrder(
  order: ProjectOrder,
  files: ReadonlyMap<string, Project | undefined>,
  issues: Issue[],
): Project[] {
  const file = CONTENT_FILES.order;
  const listed = new Set<string>();
  const projects: Project[] = [];
  for (const [era, slugs] of Object.entries(order)) {
    slugs.forEach((slug, i) => {
      const at = pointer(pointer('', era), i);
      if (listed.has(slug)) {
        issues.push(issue('order', file, at, slug, `"${slug}" is listed more than once`));
        return;
      }
      listed.add(slug);
      if (!files.has(slug)) {
        issues.push(issue('order', file, at, slug, `"${slug}" has no file ${projectFile(slug)}`));
        return;
      }
      const project = files.get(slug);
      if (project === undefined) return;
      if (project.era !== era) {
        const msg = `"${slug}" is listed under "${era}", but its era is "${project.era}"`;
        issues.push(issue('order', file, at, slug, msg));
        return;
      }
      projects.push(project);
    });
  }
  for (const [slug, project] of files) {
    if (listed.has(slug)) continue;
    const at = project === undefined ? '' : pointer('', project.era);
    issues.push(issue('order', file, at, slug, `"${slug}" is not listed in order.json`));
  }
  return projects;
}

/** `project.era` must name an era in eras.json, or the wall drops the card (FR-001). */
function checkEraRefs(projects: readonly Project[], eras: Eras, issues: Issue[]): void {
  const ids = new Set<string>(eras.map((era) => era.id));
  for (const p of projects) {
    if (ids.has(p.era)) continue;
    const msg = `era "${p.era}" is not in eras.json`;
    issues.push(issue('era-ref', projectFile(p.slug), '/era', p.slug, msg));
  }
}

/** Editorial composition across the wall sequence. Warnings only (FR-312). */
function checkComposition(sequence: readonly Project[], issues: Issue[]): void {
  const swiss = sequence.filter((p) => p.treatment === 'swiss');
  const share = swiss.length / sequence.length;
  if (sequence.length > 0 && (share < SWISS_SHARE.min || share > SWISS_SHARE.max)) {
    const pct = Math.round(share * 100);
    const msg = `Swiss cards are ${swiss.length} of ${sequence.length} (${pct} %); aim for 20–30 %`;
    issues.push(issue('swiss-share', CONTENT_FILES.order, '', null, msg));
  }
  let run = 0;
  for (const p of sequence) {
    run = p.treatment === 'standard' ? run + 1 : 0;
    if (run !== MAX_STANDARD_RUN + 1) continue;
    const msg = `"${p.slug}" is standard card ${run} in a row; the limit is ${MAX_STANDARD_RUN}`;
    issues.push(issue('standard-run', projectFile(p.slug), '/treatment', p.slug, msg));
  }
  const motifs = new Map<string, string>();
  for (const p of swiss) {
    const first = motifs.get(p.motif);
    if (first === undefined) {
      motifs.set(p.motif, p.slug);
      continue;
    }
    const msg = `Swiss motif "${p.motif}" is already used by "${first}"`;
    issues.push(issue('swiss-motif-unique', projectFile(p.slug), '/motif', p.slug, msg));
  }
}

/**
 * Validates the whole content set (FR-305): every file rule, then the bundle rules. `ok` is false
 * only on errors; warnings ride along either way (FR-312).
 */
export function validateContent(raw: RawContent, ctx: ValidationContext): Validated<ContentBundle> {
  const issues: Issue[] = [];
  for (const [file, value] of Object.entries(raw)) {
    if (!(value instanceof JsonParseFailure)) continue;
    const msg = `${file} is not valid JSON: ${value.reason}`;
    issues.push(issue('json-parse', file, '', slugOfFile(file), msg));
  }

  const files = new Map<string, Project | undefined>();
  for (const [file, value] of Object.entries(raw)) {
    const slug = slugOfFile(file);
    if (slug === null) continue;
    files.set(
      slug,
      value instanceof JsonParseFailure
        ? undefined
        : collect(validateProject(value, file, ctx), issues),
    );
  }

  const docs = {
    order: documentOf(raw, CONTENT_FILES.order, issues),
    eras: documentOf(raw, CONTENT_FILES.eras, issues),
    site: documentOf(raw, CONTENT_FILES.site, issues),
    resume: documentOf(raw, CONTENT_FILES.resume, issues),
  };
  const order = docs.order === undefined ? undefined : collect(validateOrder(docs.order), issues);
  const eras = docs.eras === undefined ? undefined : collect(validateEras(docs.eras), issues);
  const site = docs.site === undefined ? undefined : collect(validateSite(docs.site), issues);
  const resume =
    docs.resume === undefined ? undefined : collect(validateResume(docs.resume, ctx), issues);

  const projects = order === undefined ? [] : checkOrder(order, files, issues);
  if (eras !== undefined) {
    checkEraRefs(projects, eras, issues);
    checkComposition(projectSequence(buildWallItems(projects, eras)), issues);
  }

  const bundle =
    order === undefined || eras === undefined || site === undefined || resume === undefined
      ? undefined
      : { projects, order, eras, site, resume };
  return finish(bundle, issues);
}
