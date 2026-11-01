// Edit operations and the pure `apply` reducer (spec 004 edit-layer FR-383). Every op returns a
// new draft and never mutates the old one. Admin-only.
import type {
  AnyCardMedia,
  Engagement,
  EraId,
  Layout,
  MotifName,
  Period,
  Project,
  ProjectOrder,
  Size,
  ThemeName,
  Treatment,
} from '../../content/types.ts';
import { ERA_IDS } from '../../content/era-ids.ts';
import {
  type Draft,
  type EditableProject,
  type History,
  type StagedFile,
  record,
} from './draft.ts';
import {
  type ItemOp,
  type ListName,
  addItem,
  inRange,
  listOf,
  mapItems,
  moved,
  setItem,
  withList,
} from './lists.ts';
import { parsePointer, setText } from './pointers.ts';

export { isTextPointer, parsePointer, type TextPointer, type TextTarget } from './pointers.ts';
export type { ListName } from './lists.ts';

// ---- Ops ----

/** Card and identity settings from the panel (FR-388, FR-389). `seed: null` omits the seed. */
export interface SettingsPatch {
  readonly client?: string;
  readonly role?: string;
  readonly era?: EraId;
  readonly engagement?: Engagement;
  readonly period?: Period;
  readonly size?: Size;
  readonly treatment?: Treatment;
  readonly layout?: Layout;
  readonly theme?: ThemeName;
  readonly motif?: MotifName;
  readonly seed?: number | null;
  readonly media?: AnyCardMedia;
  /** Primary first, then an optional secondary (006 FR-501). */
  readonly categories?: Project['categories'];
  /** The content `draft` flag ("Show the Draft copy notice"). */
  readonly draft?: boolean;
}

export type EditOp =
  | { readonly kind: 'text'; readonly pointer: string; readonly value: string }
  | { readonly kind: 'settings'; readonly patch: SettingsPatch }
  | ItemOp
  | { readonly kind: 'remove'; readonly list: ListName; readonly index: number }
  | { readonly kind: 'move'; readonly list: ListName; readonly from: number; readonly to: number }
  | { readonly kind: 'stage'; readonly file: StagedFile }
  | { readonly kind: 'unstage'; readonly path: string }
  | { readonly kind: 'move-in-era'; readonly to: number };

export type ApplyError = 'unknown-pointer' | 'out-of-range' | 'not-listed';
export type ApplyResult<T = Draft> =
  { readonly ok: true; readonly draft: T } | { readonly ok: false; readonly reason: ApplyError };

const ok = <T>(draft: T): ApplyResult<T> => ({ ok: true, draft });
const err = <T>(reason: ApplyError): ApplyResult<T> => ({ ok: false, reason });

// ---- Settings ----

function patchSettings(p: EditableProject, patch: SettingsPatch): EditableProject {
  const { seed, draft, ...fields } = patch;
  let next: EditableProject = { ...p, ...fields };
  if (seed !== undefined) {
    const { seed: _old, ...rest } = next;
    next = seed === null ? rest : { ...rest, seed };
  }
  if (draft !== undefined) {
    const { draft: _old, ...rest } = next;
    next = draft ? { ...rest, draft: true } : rest;
  }
  return next;
}

// ---- Order ----

type Order = Partial<Record<EraId, readonly string[]>>;

function unlisted(order: ProjectOrder, slug: string): Order {
  const next: Order = {};
  for (const era of ERA_IDS) {
    const slugs = order[era];
    if (slugs !== undefined) next[era] = slugs.filter((s) => s !== slug);
  }
  return next;
}

/** Moving to another era puts the project at the top of it, as `planUpdate` does. */
function reEra(order: ProjectOrder, slug: string, era: EraId): ProjectOrder {
  const next = unlisted(order, slug);
  next[era] = [slug, ...(next[era] ?? [])];
  return next;
}

function moveInEra(d: Draft, to: number): ApplyResult {
  const slugs = d.order[d.working.era] ?? [];
  const from = slugs.indexOf(d.slug);
  if (from < 0) return err('not-listed');
  if (!Number.isInteger(to) || to < 0 || to >= slugs.length) return err('out-of-range');
  return ok({ ...d, order: { ...d.order, [d.working.era]: moved(slugs, from, to) } });
}

// ---- The reducer ----

const withWorking = (d: Draft, working: EditableProject): Draft => ({ ...d, working });

export function apply(d: Draft, op: EditOp): ApplyResult {
  const p = d.working;
  switch (op.kind) {
    case 'text': {
      const target = parsePointer(op.pointer);
      if (target === null) return err('unknown-pointer');
      const next = setText(p, target, op.value);
      return next === null ? err('out-of-range') : ok(withWorking(d, next));
    }
    case 'settings': {
      const working = patchSettings(p, op.patch);
      const era = op.patch.era;
      const order = era !== undefined && era !== p.era ? reEra(d.order, d.slug, era) : d.order;
      return ok({ ...d, working, order });
    }
    case 'add':
      return ok(withWorking(d, addItem(p, op)));
    case 'set-item': {
      const next = setItem(p, op);
      return next === null ? err('out-of-range') : ok(withWorking(d, next));
    }
    case 'remove': {
      const v = listOf(p, op.list);
      if (!inRange(v.items, op.index)) return err('out-of-range');
      const drop = <T>(items: readonly T[]): T[] => items.filter((_, i) => i !== op.index);
      return ok(withWorking(d, withList(p, mapItems(v, drop))));
    }
    case 'move': {
      const v = listOf(p, op.list);
      if (!inRange(v.items, op.from) || !inRange(v.items, op.to)) return err('out-of-range');
      const move = <T>(items: readonly T[]): T[] => moved(items, op.from, op.to);
      return ok(withWorking(d, withList(p, mapItems(v, move))));
    }
    case 'stage':
      return ok({ ...d, staged: [...d.staged.filter((f) => f.path !== op.file.path), op.file] });
    case 'unstage':
      return ok({ ...d, staged: d.staged.filter((f) => f.path !== op.path) });
    case 'move-in-era':
      return moveInEra(d, op.to);
  }
}

/** `apply` plus undo recording. Text ops pass the field's focus `group` (FR-383). */
export function commit(h: History, op: EditOp, group: string | null = null): ApplyResult<History> {
  const result = apply(h.draft, op);
  return result.ok ? ok(record(h, result.draft, group)) : result;
}
