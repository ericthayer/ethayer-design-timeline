// Change plans for the editor (spec 004 content-json, FR-309). Each plan validates the resulting
// bundle and returns the file changes, a structural subset of github-publish's `FileChange`.
// A plan with errors yields no changes. Admin-only: never import this from public code (FR-304).
import { CONTENT_FILES, projectFile, serialize } from './paths.ts';
import {
  type ContentBundle,
  type Issue,
  type RawContent,
  type ValidationContext,
  type Validated,
  validateContent,
} from './validate/index.ts';
import { issue } from './validate/issue.ts';
import { isRecord, isString } from './validate/read.ts';

export type ContentChange =
  | { readonly kind: 'put'; readonly path: string; readonly content: string }
  | { readonly kind: 'delete'; readonly path: string };

type Plan = Validated<readonly ContentChange[]>;
type Order = Record<string, string[]>;

const fail = (errors: readonly Issue[]): Plan => ({ ok: false, errors, warnings: [] });

/** A field of a not-yet-validated project, if it is a string. */
function field(project: unknown, key: 'slug' | 'era'): string | null {
  if (!isRecord(project)) return null;
  const value = project[key];
  return isString(value) ? value : null;
}

/** A mutable copy of `order.json`'s lists. A broken file copies as `{}`, which then fails `order`. */
function copyOrder(raw: RawContent): Order {
  const order = raw[CONTENT_FILES.order];
  if (!isRecord(order)) return {};
  const copy: Order = {};
  for (const [era, slugs] of Object.entries(order)) {
    copy[era] = Array.isArray(slugs) ? slugs.filter(isString) : [];
  }
  return copy;
}

/** Removes `slug` from every era. True when it was listed. */
function unlist(order: Order, slug: string): boolean {
  let found = false;
  for (const [era, slugs] of Object.entries(order)) {
    const kept = slugs.filter((s) => s !== slug);
    found ||= kept.length !== slugs.length;
    order[era] = kept;
  }
  return found;
}

/** Inserts `slug` at index `at` of `era` (0 = top; past the end appends). */
function list(order: Order, era: string, slug: string, at: number): void {
  const slugs = order[era] ?? [];
  slugs.splice(Math.max(0, Math.min(at, slugs.length)), 0, slug);
  order[era] = slugs;
}

const putProject = (bundle: ContentBundle, slug: string): ContentChange[] =>
  bundle.projects
    .filter((p) => p.slug === slug)
    .map((p) => ({ kind: 'put', path: projectFile(p.slug), content: serialize(p) }));

const putOrder = (bundle: ContentBundle): ContentChange => ({
  kind: 'put',
  path: CONTENT_FILES.order,
  content: serialize(bundle.order),
});

function plan(
  next: RawContent,
  ctx: ValidationContext,
  changes: (bundle: ContentBundle) => readonly ContentChange[],
): Plan {
  const result = validateContent(next, ctx);
  if (!result.ok) return result;
  return { ok: true, value: changes(result.value), warnings: result.warnings };
}

/** A new project at index `at` of its era in `order.json` (FR-309, edit-layer X4). */
export function planCreate(
  raw: RawContent,
  project: unknown,
  at: number,
  ctx: ValidationContext,
): Plan {
  const slug = field(project, 'slug') ?? '';
  const file = projectFile(slug);
  if (Object.hasOwn(raw, file)) {
    return fail([issue('slug', file, '/slug', slug, `a project named "${slug}" already exists`)]);
  }
  const order = copyOrder(raw);
  unlist(order, slug);
  list(order, field(project, 'era') ?? '', slug, at);
  const next = { ...raw, [file]: project, [CONTENT_FILES.order]: order };
  return plan(next, ctx, (bundle) => [...putProject(bundle, slug), putOrder(bundle)]);
}

/**
 * Replaces a project. Slugs are immutable (rule `slug`, owner decision D6). Moving it to another
 * era also moves it in `order.json`, to the top of the new era.
 */
export function planUpdate(
  raw: RawContent,
  slug: string,
  project: unknown,
  ctx: ValidationContext,
): Plan {
  const file = projectFile(slug);
  if (!Object.hasOwn(raw, file)) {
    return fail([issue('slug', file, '', slug, `there is no project named "${slug}"`)]);
  }
  const next = field(project, 'slug');
  if (next !== slug) {
    const msg = `the slug "${slug}" cannot change (to "${String(next)}"); create a new project instead`;
    return fail([issue('slug', file, '/slug', slug, msg)]);
  }
  const era = field(project, 'era');
  const moved = era !== null && era !== field(raw[file], 'era');
  const order = copyOrder(raw);
  if (moved) {
    unlist(order, slug);
    list(order, era, slug, 0);
  }
  const content = { ...raw, [file]: project, [CONTENT_FILES.order]: order };
  return plan(content, ctx, (bundle) => [
    ...putProject(bundle, slug),
    ...(moved ? [putOrder(bundle)] : []),
  ]);
}

/** Deletes the project file and its `order.json` entry in the same change set (US21). */
export function planDelete(raw: RawContent, slug: string, ctx: ValidationContext): Plan {
  const file = projectFile(slug);
  if (!Object.hasOwn(raw, file)) {
    return fail([issue('slug', file, '', slug, `there is no project named "${slug}"`)]);
  }
  const order = copyOrder(raw);
  unlist(order, slug);
  const next = Object.fromEntries(Object.entries(raw).filter(([path]) => path !== file));
  next[CONTENT_FILES.order] = order;
  return plan(next, ctx, (bundle) => [{ kind: 'delete', path: file }, putOrder(bundle)]);
}

/** A new curated order for one era. Only `order.json` changes (US21). */
export function planReorder(
  raw: RawContent,
  era: string,
  slugs: readonly string[],
  ctx: ValidationContext,
): Plan {
  const order = copyOrder(raw);
  order[era] = [...slugs];
  const next = { ...raw, [CONTENT_FILES.order]: order };
  return plan(next, ctx, (bundle) => [putOrder(bundle)]);
}
