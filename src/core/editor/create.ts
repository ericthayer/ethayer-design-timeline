// New project defaults and slug checks (spec 004 edit-layer FR-393). Pure.
import { CONTENT_FILES, projectFile } from '../../content/paths.ts';
import { MOTIFS } from '../../content/motifs.ts';
import type { Era, EraId, Project, ProjectOrder, YearMonth } from '../../content/types.ts';
import type { Draft, EditableProject } from './draft.ts';

/** content-json `slug`: lowercase kebab case. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface CreateFields {
  readonly slug: string;
  readonly title: string;
  readonly era: Era;
  readonly client: string;
  readonly role: string;
}

/** Why a slug can't be used, or null. `taken` is the bundle, the repo order, and local drafts. */
export function slugProblem(slug: string, taken: ReadonlySet<string>): string | null {
  if (slug === '') return 'Enter a slug.';
  if (!SLUG_PATTERN.test(slug)) return 'Use lowercase letters, digits, and single hyphens.';
  if (taken.has(slug)) return `A project named ${slug} already exists.`;
  return null;
}

/** Every slug `order.json` lists. */
export const listedSlugs = (order: ProjectOrder): string[] => Object.values(order).flat();

/** "2026-11" for a date, in local time. */
const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] as const;
export function thisMonth(now: Date): YearMonth {
  return `${now.getFullYear()}-${MONTHS[now.getMonth()] ?? '01'}`;
}

/** The first motif no Swiss card uses (FR-393), else the first motif. */
export function freeMotif(
  projects: readonly Pick<Project, 'treatment' | 'motif'>[],
): Project['motif'] {
  const used = new Set(projects.filter((p) => p.treatment === 'swiss').map((p) => p.motif));
  return MOTIFS.find((m) => !used.has(m)) ?? MOTIFS[0];
}

/** The FR-393 defaults around the form's fields. */
export function newProject(
  fields: CreateFields,
  motif: Project['motif'],
  now: Date,
): EditableProject {
  return {
    slug: fields.slug,
    title: fields.title,
    client: fields.client,
    era: fields.era.id,
    engagement: fields.era.engagement,
    role: fields.role,
    period: { start: thisMonth(now), end: 'present' },
    size: 'sm',
    treatment: 'standard',
    layout: 'title-bottom',
    media: { kind: 'placeholder', variant: 'site' },
    theme: 'paper-ink',
    motif,
    summary: '',
    body: { context: '', contribution: '', outcome: '' },
    tracklist: [],
    draft: true,
  };
}

/** `order` with `slug` at index 0 of `era` and nowhere else (edit-layer X4). */
export function orderWith(order: ProjectOrder, era: EraId, slug: string): ProjectOrder {
  const next: Record<string, readonly string[]> = {};
  for (const [id, slugs] of Object.entries(order)) next[id] = slugs.filter((s) => s !== slug);
  next[era] = [slug, ...(next[era] ?? [])];
  return next;
}

/** A create draft on the repo head: the project file didn't exist there (FR-393). */
export function createDraft(
  working: EditableProject,
  sha: string,
  order: ProjectOrder,
  orderText: string,
): Draft {
  return {
    v: 1,
    slug: working.slug,
    action: 'create',
    base: { sha, files: { [projectFile(working.slug)]: null, [CONTENT_FILES.order]: orderText } },
    working,
    order: orderWith(order, working.era, working.slug),
    staged: [],
    savedAt: 0,
  };
}

/** A create draft under a new slug, before its first publish (FR-393). */
export function renameCreate(draft: Draft, slug: string): Draft {
  const old = projectFile(draft.slug);
  const files = Object.fromEntries(Object.entries(draft.base.files).filter(([p]) => p !== old));
  return {
    ...draft,
    slug,
    base: { ...draft.base, files: { ...files, [projectFile(slug)]: null } },
    working: { ...draft.working, slug },
    order: Object.fromEntries(
      Object.entries(draft.order).map(([era, slugs]) => [
        era,
        slugs.map((s) => (s === draft.slug ? slug : s)),
      ]),
    ),
  };
}
