// The changes builder (spec 004 edit-layer FR-393–FR-395): a draft → content-json plan functions
// + media changes → `{ changes, issues, gate }`. The plan functions are the validator call, so
// this file holds no content rule. Pure: media bytes are resolved by the publish flow.
import {
  type ContentChange,
  planCreate,
  planDelete,
  planReorder,
  planUpdate,
} from '../../content/changes.ts';
import { CONTENT_FILES, projectFile } from '../../content/paths.ts';
import {
  type Issue,
  type RawContent,
  type Validated,
  type ValidationContext,
  parseJson,
} from '../../content/validate/index.ts';
import { isRecord } from '../../content/validate/read.ts';
import type { ImageManifest } from '../media-rules.ts';
import { type Draft, baseJson, same } from './draft.ts';
import { type Gate, gateOf } from './issues.ts';
import { mediaDeletes, deletePaths, referencedKeys } from './media.ts';

/** A change to send. `put-media` gets its bytes from the staged `File` at publish time. */
export type PlannedChange =
  | ContentChange
  | { readonly kind: 'put-media'; readonly path: string }
  | { readonly kind: 'delete-dir'; readonly path: string };

export interface Built {
  readonly changes: readonly PlannedChange[];
  readonly issues: readonly Issue[];
  readonly gate: Gate;
}

/** Facts from outside the content: the frame-src list and the committed manifests. */
export interface EditorContext {
  readonly frameOrigins: readonly string[];
  /** `null` when the manifests aren't known, which skips the manifest checks. */
  readonly images: ImageManifest | null;
  readonly videoKeys: ReadonlySet<string> | null;
}

type Plan = Validated<readonly ContentChange[]>;

const issuesOf = (plan: Plan): readonly Issue[] =>
  plan.ok ? plan.warnings : [...plan.errors, ...plan.warnings];

function built(changes: readonly PlannedChange[], issues: readonly Issue[]): Built {
  const gate = gateOf(issues);
  return { changes: gate === 'blocked' ? [] : changes, issues, gate };
}

/** The raw content after a set of content changes, as the commit would leave it. */
export function applyContent(raw: RawContent, changes: readonly ContentChange[]): RawContent {
  const next = new Map(Object.entries(raw));
  for (const change of changes) {
    if (change.kind === 'put') next.set(change.path, parseJson(change.content));
    else next.delete(change.path);
  }
  return Object.fromEntries(next);
}

/** `ctx.mediaKeys` and `ctx.videoKeys` = manifest ∪ staged − deleted (FR-392). */
export function validationContext(
  ctx: EditorContext,
  staged: Draft['staged'],
  deleted: (key: string) => boolean = () => false,
): ValidationContext {
  const images = new Set(ctx.images === null ? [] : Object.keys(ctx.images));
  const videos = new Set(ctx.videoKeys ?? []);
  const videoExts = new Map<string, Set<string>>();
  for (const file of staged) {
    const ext = file.path.slice(file.path.lastIndexOf('.') + 1);
    if (ext === 'mp4' || ext === 'webm') {
      videoExts.set(file.key, (videoExts.get(file.key) ?? new Set()).add(ext));
    } else {
      images.add(file.key);
    }
  }
  for (const [key, exts] of videoExts) if (exts.size === 2) videos.add(key);
  const keep = (keys: Set<string>): Set<string> => new Set([...keys].filter((k) => !deleted(k)));
  return {
    frameOrigins: ctx.frameOrigins,
    mediaKeys: ctx.images === null ? null : keep(images),
    videoKeys: ctx.videoKeys === null ? null : keep(videos),
  };
}

const orderIn = (order: unknown, era: string): unknown =>
  isRecord(order) ? order[era] : undefined;

function contentPlan(draft: Draft, raw: RawContent, vctx: ValidationContext): Plan {
  const { working, slug } = draft;
  const listed = draft.order[working.era] ?? [];
  if (draft.action === 'create') {
    return planCreate(raw, working, Math.max(0, listed.indexOf(slug)), vctx);
  }
  const update = planUpdate(raw, slug, working, vctx);
  if (!update.ok) return update;
  const next = applyContent(raw, update.value);
  if (same(orderIn(next[CONTENT_FILES.order], working.era), listed)) return update;
  const reorder = planReorder(next, working.era, listed, vctx);
  if (!reorder.ok) return reorder;
  const project = update.value.filter((c) => c.path !== CONTENT_FILES.order);
  return { ok: true, value: [...project, ...reorder.value], warnings: reorder.warnings };
}

function mediaChanges(draft: Draft, next: RawContent, ctx: EditorContext): PlannedChange[] {
  const used = referencedKeys([draft.working]);
  const puts = draft.staged.filter((f) => used.has(f.key)).map((f) => f.path);
  const putSet = new Set(puts);
  const images = ctx.images ?? {};
  const videoKeys = ctx.videoKeys ?? new Set<string>();
  const replaced = draft.staged
    .filter((f) => putSet.has(f.path))
    .flatMap((f) => {
      const image = images[f.key];
      if (image !== undefined) return deletePaths(f.key, 'image', putSet, image.source);
      return videoKeys.has(f.key) ? deletePaths(f.key, 'video', putSet) : [];
    });
  const unused = mediaDeletes({
    before: referencedKeys([baseJson(draft, projectFile(draft.slug))]),
    after: referencedKeys(Object.values(next)),
    images,
    videoKeys,
    puts: putSet,
  });
  const deletes = [...new Set([...replaced, ...unused])];
  return [
    ...puts.map((path): PlannedChange => ({ kind: 'put-media', path })),
    ...deletes.map((path): PlannedChange => ({ kind: 'delete', path })),
  ];
}

/** Create or update: the project file, `order.json` when it moved, and media (FR-393, FR-395). */
export function buildChanges(draft: Draft, raw: RawContent, ctx: EditorContext): Built {
  const plan = contentPlan(draft, raw, validationContext(ctx, draft.staged));
  if (!plan.ok) return built([], issuesOf(plan));
  const next = applyContent(raw, plan.value);
  // planUpdate always writes the project; a put that matches the base is no change.
  const content = plan.value.filter((c) => {
    const base = draft.base.files[c.path];
    return c.kind !== 'put' || base == null || !same(parseJson(c.content), parseJson(base));
  });
  return built([...content, ...mediaChanges(draft, next, ctx)], issuesOf(plan));
}

/**
 * Delete: the JSON, its `order.json` entry, and `media-src/<slug>/` in one commit (FR-394). Keys
 * under the folder leave the context, so a reference from another project blocks the delete.
 */
export function buildDelete(raw: RawContent, slug: string, ctx: EditorContext): Built {
  const vctx = validationContext(ctx, [], (key) => key.startsWith(`${slug}/`));
  const plan = planDelete(raw, slug, vctx);
  if (!plan.ok) return built([], issuesOf(plan));
  return built([...plan.value, { kind: 'delete-dir', path: `media-src/${slug}/` }], issuesOf(plan));
}

/** The draft after a commit of `changes` at `sha`: its base is what the commit left (FR-397). */
export function rebase(draft: Draft, sha: string, changes: readonly PlannedChange[]): Draft {
  const files = new Map(Object.entries(draft.base.files));
  for (const change of changes) {
    if (change.kind === 'put') files.set(change.path, change.content);
    else if (change.kind === 'delete') files.set(change.path, null);
  }
  return {
    ...draft,
    action: 'update',
    base: { sha, files: Object.fromEntries(files) },
    staged: [],
    savedAt: 0,
  };
}

/** Only the JSON changes, for `applyContent`. */
export const contentOnly = (changes: readonly PlannedChange[]): ContentChange[] =>
  changes.flatMap((c) => (c.kind === 'put' || c.kind === 'delete' ? [c] : []));
