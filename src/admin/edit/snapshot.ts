// Snapshot: the editor's base comes from GitHub at a sha, never from the bundle (spec 004
// edit-layer FR-384, plan §2.4). That is what makes `expectedHeadSha` honest. The bundle and the
// repo are compared structurally (`same`), which equals comparing their `serialize` output.
import type { AdminSession } from '../../core/auth/session.ts';
import { type Draft, same } from '../../core/editor/draft.ts';
import type { GitHubError, HeadResult, ReadFileResult } from '../../core/github/types.ts';
import { ERA_IDS } from '../../content/era-ids.ts';
import { CONTENT_FILES, projectFile } from '../../content/paths.ts';
import type { Project, ProjectOrder } from '../../content/types.ts';
import {
  type Issue,
  type RawContent,
  type ValidationContext,
  parseJson,
  validateProject,
} from '../../content/validate/index.ts';
import { isRecord, isString } from '../../content/validate/read.ts';

/** The content the public bundle shipped with. */
export interface Bundled {
  readonly projects: readonly Project[];
  readonly order: ProjectOrder;
  readonly eras: unknown;
  readonly site: unknown;
  readonly resume: unknown;
}

/** github-publish's read calls, injected so tests can fake GitHub. */
export interface Reader {
  readHead(session: AdminSession): Promise<HeadResult>;
  readFile(session: AdminSession, path: string, ref: string): Promise<ReadFileResult>;
}

type ReadFailure = Exclude<ReadFileResult, { kind: 'ok' }> | GitHubError;

export type Snapshot =
  | {
      readonly kind: 'ok';
      readonly sha: string;
      /** Repo text at `sha`; `null` for a file that doesn't exist there. */
      readonly files: Readonly<Record<string, string | null>>;
      /** The bundle for validation: repo order and edited file, bundled copies for the rest. */
      readonly raw: RawContent;
      readonly order: ProjectOrder;
      /** The edited project, or null for a new slug. */
      readonly project: Project | null;
      /** The live site is behind the repository for these files. */
      readonly behind: boolean;
      /** Set when the repo file fails validation: the project opens read-only. */
      readonly invalid: readonly Issue[] | null;
    }
  | { readonly kind: 'failed'; readonly error: ReadFailure };

export const BEHIND_NOTICE =
  "The live site is behind the repository. You're editing the repository version.";

/** A typed `order.json`: known eras, string slugs. Anything else reads as empty. */
export function readOrder(value: unknown): ProjectOrder {
  const order: Partial<Record<(typeof ERA_IDS)[number], readonly string[]>> = {};
  if (!isRecord(value)) return order;
  for (const era of ERA_IDS) {
    const slugs = value[era];
    if (Array.isArray(slugs)) order[era] = slugs.filter(isString);
  }
  return order;
}

async function text(
  reader: Reader,
  session: AdminSession,
  path: string,
  sha: string,
): Promise<{ kind: 'ok'; text: string | null } | ReadFailure> {
  const file = await reader.readFile(session, path, sha);
  if (file.kind === 'ok') return { kind: 'ok', text: file.text };
  return file.kind === 'not-found' ? { kind: 'ok', text: null } : file;
}

const slugsOf = (order: ProjectOrder): string[] => Object.values(order).flat();

/**
 * Reads the head, then the project file and `order.json` at that sha. Listed projects that the
 * bundle doesn't have are read too, so validation sees the repository (FR-384).
 */
export async function takeSnapshot(
  session: AdminSession,
  slug: string,
  bundled: Bundled,
  ctx: ValidationContext,
  reader: Reader,
): Promise<Snapshot> {
  const head = await reader.readHead(session);
  if (head.kind !== 'ok') return { kind: 'failed', error: head };
  const sha = head.sha;
  const file = projectFile(slug);
  const files: Record<string, string | null> = {};
  for (const path of [file, CONTENT_FILES.order]) {
    const read = await text(reader, session, path, sha);
    if (read.kind !== 'ok') return { kind: 'failed', error: read };
    files[path] = read.text;
  }
  const orderText = files[CONTENT_FILES.order] ?? null;
  if (orderText === null) return { kind: 'failed', error: { kind: 'not-found' } };
  const order = readOrder(parseJson(orderText));
  const bySlug = new Map(bundled.projects.map((p) => [p.slug, p]));
  const raw: Record<string, unknown> = {
    [CONTENT_FILES.order]: parseJson(orderText),
    [CONTENT_FILES.eras]: bundled.eras,
    [CONTENT_FILES.site]: bundled.site,
    [CONTENT_FILES.resume]: bundled.resume,
  };
  for (const listed of slugsOf(order)) {
    const path = projectFile(listed);
    const copy = bySlug.get(listed);
    if (listed !== slug && copy !== undefined) {
      raw[path] = copy;
      continue;
    }
    if (!(path in files)) {
      const read = await text(reader, session, path, sha);
      if (read.kind !== 'ok') return { kind: 'failed', error: read };
      files[path] = read.text;
    }
    const repoText = files[path] ?? null;
    if (repoText !== null) raw[path] = parseJson(repoText);
  }
  const repoText = files[file] ?? null;
  const ownText = repoText === null ? null : parseJson(repoText);
  const checked = ownText === null ? null : validateProject(ownText, file, ctx);
  const project = checked?.ok === true ? checked.value : null;
  const invalid = checked === null || checked.ok ? null : checked.errors;
  const bundledOwn = bySlug.get(slug);
  const behind =
    (repoText !== null && bundledOwn !== undefined && !same(ownText, bundledOwn)) ||
    !same(order, bundled.order);
  return { kind: 'ok', sha, files, raw, order, project, behind, invalid };
}

/** A fresh update draft from a valid snapshot. */
export function draftFrom(slug: string, snap: Extract<Snapshot, { kind: 'ok' }>): Draft | null {
  if (snap.project === null) return null;
  return {
    v: 1,
    slug,
    action: 'update',
    base: { sha: snap.sha, files: snap.files },
    working: snap.project,
    order: snap.order,
    staged: [],
    savedAt: 0,
  };
}
