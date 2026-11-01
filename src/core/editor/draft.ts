// Draft model for the admin editor (spec 004 edit-layer FR-383, §6). Pure: no DOM, no `node:*`.
// Admin-only: public code never imports src/core/editor/.
import { CONTENT_FILES, projectFile } from '../../content/paths.ts';
import { parseJson } from '../../content/validate/issue.ts';
import { type Json, isRecord } from '../../content/validate/read.ts';
import type { AnyCardMedia, Project, ProjectOrder, Size } from '../../content/types.ts';

/** A project with `size` and `media` widened, so an invalid pair can sit in a draft (FR-382). */
export type EditableProject = Omit<Project, 'size' | 'media'> & {
  readonly size: Size;
  readonly media: AnyCardMedia;
};

/** A picked file. The `File` itself lives in IndexedDB's `blobs` store, keyed by `path` (FR-385). */
export interface StagedFile {
  /** Repo path, e.g. `media-src/dmns/my-shot.png`. */
  readonly path: string;
  /** Manifest key, e.g. `dmns/my-shot`. */
  readonly key: string;
  /** MIME type. */
  readonly type: string;
  /** File size in bytes. */
  readonly bytes: number;
  readonly width: number | null;
  readonly height: number | null;
}

export interface Draft {
  readonly v: 1;
  readonly slug: string;
  readonly action: 'create' | 'update';
  /** Repo text per path at `sha`. `null` means the file did not exist there. */
  readonly base: { readonly sha: string; readonly files: Readonly<Record<string, string | null>> };
  readonly working: EditableProject;
  readonly order: ProjectOrder;
  readonly staged: readonly StagedFile[];
  readonly savedAt: number;
}

const definedKeys = (r: Json): string[] => Object.keys(r).filter((k) => r[k] !== undefined);

/** Structural deep equality for JSON values. Object key order and `undefined` keys do not matter. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, i) => same(value, b[i]));
  }
  if (!isRecord(a) || !isRecord(b)) return false;
  const ka = definedKeys(a);
  return ka.length === definedKeys(b).length && ka.every((k) => same(a[k], b[k]));
}

const asRecord = (value: unknown): Json => (isRecord(value) ? value : {});

/** The base file at `path`, parsed. A missing or broken file reads as `{}`. */
export function baseJson(draft: Draft, path: string): Json {
  const text = draft.base.files[path];
  return text == null ? {} : asRecord(parseJson(text));
}

const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

/**
 * Differing top-level fields (`body` per paragraph, `gallery` per index), plus 1 if the order
 * changed, plus each staged file (FR-383).
 */
export function changeCount(draft: Draft): number {
  const base = baseJson(draft, projectFile(draft.slug));
  const working = asRecord(draft.working);
  let count = 0;
  const keys = new Set([...Object.keys(base), ...Object.keys(working)]);
  for (const key of keys) {
    const a = base[key];
    const b = working[key];
    if (key === 'body') {
      const ba = asRecord(a);
      const bb = asRecord(b);
      for (const p of new Set([...Object.keys(ba), ...Object.keys(bb)])) {
        if (!same(ba[p], bb[p])) count += 1;
      }
    } else if (key === 'gallery') {
      const ga = listOf(a);
      const gb = listOf(b);
      for (let i = 0; i < Math.max(ga.length, gb.length); i += 1) {
        if (!same(ga[i], gb[i])) count += 1;
      }
    } else if (!same(a, b)) {
      count += 1;
    }
  }
  if (!same(baseJson(draft, CONTENT_FILES.order), draft.order)) count += 1;
  return count + draft.staged.length;
}

// ---- Undo and redo (FR-383): the last 20 working copies, in memory only ----

export const UNDO_LIMIT = 20;

interface Snapshot {
  readonly working: EditableProject;
  readonly order: ProjectOrder;
  readonly staged: readonly StagedFile[];
}

export interface History {
  readonly draft: Draft;
  readonly past: readonly Snapshot[];
  readonly future: readonly Snapshot[];
  /** The open text group (one per field focus), or null. */
  readonly group: string | null;
}

const snap = (d: Draft): Snapshot => ({ working: d.working, order: d.order, staged: d.staged });
const restore = (d: Draft, s: Snapshot): Draft => ({ ...d, ...s });

export const begin = (draft: Draft): History => ({ draft, past: [], future: [], group: null });

/**
 * Records `next` as the new present. A step with the same non-null `group` as the open one
 * folds into it, so typing in one field is one undo step.
 */
export function record(history: History, next: Draft, group: string | null = null): History {
  if (group !== null && group === history.group) {
    return { ...history, draft: next, future: [] };
  }
  const past = [...history.past, snap(history.draft)].slice(-UNDO_LIMIT);
  return { draft: next, past, future: [], group };
}

/** Closes the open text group, e.g. when the field loses focus. */
export const endGroup = (history: History): History => ({ ...history, group: null });

export function undo(history: History): History {
  const prev = history.past.at(-1);
  if (prev === undefined) return history;
  return {
    draft: restore(history.draft, prev),
    past: history.past.slice(0, -1),
    future: [snap(history.draft), ...history.future],
    group: null,
  };
}

export function redo(history: History): History {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return {
    draft: restore(history.draft, next),
    past: [...history.past, snap(history.draft)].slice(-UNDO_LIMIT),
    future: rest,
    group: null,
  };
}

export const canUndo = (history: History): boolean => history.past.length > 0;
export const canRedo = (history: History): boolean => history.future.length > 0;
