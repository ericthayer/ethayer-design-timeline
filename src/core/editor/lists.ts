// List editing for the draft reducer (spec 004 edit-layer FR-383, FR-387, FR-390). Pure. Every
// helper copies; nothing mutates its input.
import type { GalleryItem, Metric, ProjectLink, TrackItem } from '../../content/types.ts';
import type { EditableProject } from './draft.ts';

export interface Lists {
  readonly tracklist: TrackItem;
  readonly metrics: Metric;
  readonly links: ProjectLink;
  readonly gallery: GalleryItem;
}
export type ListName = keyof Lists;

export type ItemOp = {
  [L in ListName]:
    | { readonly kind: 'add'; readonly list: L; readonly item: Lists[L]; readonly at?: number }
    | {
        readonly kind: 'set-item';
        readonly list: L;
        readonly index: number;
        readonly item: Lists[L];
      };
}[ListName];

// ---- List helpers: always copy ----

export const inRange = (list: readonly unknown[], i: number): boolean =>
  Number.isInteger(i) && i >= 0 && i < list.length;

export const replaceAt = <T>(list: readonly T[], i: number, item: T): T[] =>
  list.map((value, j) => (j === i ? item : value));

export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

export function inserted<T>(list: readonly T[], item: T, at: number | undefined): T[] {
  const next = [...list];
  next.splice(at === undefined ? next.length : Math.max(0, Math.min(at, next.length)), 0, item);
  return next;
}

/** A list together with its name, so each pair stays correlated without casts. */
type ListValue = {
  [L in ListName]: { readonly list: L; readonly items: readonly Lists[L][] };
}[ListName];

export function listOf(p: EditableProject, list: ListName): ListValue {
  switch (list) {
    case 'tracklist':
      return { list, items: p.tracklist };
    case 'metrics':
      return { list, items: p.metrics ?? [] };
    case 'links':
      return { list, items: p.links ?? [] };
    case 'gallery':
      return { list, items: p.gallery ?? [] };
  }
}

/** Applies an order-only change (filter, move) to any list. */
export function mapItems(v: ListValue, f: <T>(items: readonly T[]) => readonly T[]): ListValue {
  switch (v.list) {
    case 'tracklist':
      return { list: v.list, items: f(v.items) };
    case 'metrics':
      return { list: v.list, items: f(v.items) };
    case 'links':
      return { list: v.list, items: f(v.items) };
    case 'gallery':
      return { list: v.list, items: f(v.items) };
  }
}

/** Writes a list back. An empty optional list is omitted from the file. */
export function withList(p: EditableProject, v: ListValue): EditableProject {
  switch (v.list) {
    case 'tracklist':
      return { ...p, tracklist: v.items };
    case 'metrics': {
      const { metrics: _old, ...rest } = p;
      return v.items.length === 0 ? rest : { ...rest, metrics: v.items };
    }
    case 'links': {
      const { links: _old, ...rest } = p;
      return v.items.length === 0 ? rest : { ...rest, links: v.items };
    }
    case 'gallery': {
      const { gallery: _old, ...rest } = p;
      return v.items.length === 0 ? rest : { ...rest, gallery: v.items };
    }
  }
}

const at = (op: { readonly at?: number }): number | undefined => op.at;

// Each case narrows the correlated `list` + `item` pair without a cast.
export function addItem(p: EditableProject, op: Extract<ItemOp, { kind: 'add' }>): EditableProject {
  switch (op.list) {
    case 'tracklist':
      return withList(p, { list: op.list, items: inserted(p.tracklist, op.item, at(op)) });
    case 'metrics':
      return withList(p, { list: op.list, items: inserted(p.metrics ?? [], op.item, at(op)) });
    case 'links':
      return withList(p, { list: op.list, items: inserted(p.links ?? [], op.item, at(op)) });
    case 'gallery':
      return withList(p, { list: op.list, items: inserted(p.gallery ?? [], op.item, at(op)) });
  }
}

export function setItem(
  p: EditableProject,
  op: Extract<ItemOp, { kind: 'set-item' }>,
): EditableProject | null {
  const { index } = op;
  const put = <T>(items: readonly T[], item: T): T[] | null =>
    inRange(items, index) ? replaceAt(items, index, item) : null;
  switch (op.list) {
    case 'tracklist': {
      const items = put(p.tracklist, op.item);
      return items && withList(p, { list: op.list, items });
    }
    case 'metrics': {
      const items = put(p.metrics ?? [], op.item);
      return items && withList(p, { list: op.list, items });
    }
    case 'links': {
      const items = put(p.links ?? [], op.item);
      return items && withList(p, { list: op.list, items });
    }
    case 'gallery': {
      const items = put(p.gallery ?? [], op.item);
      return items && withList(p, { list: op.list, items });
    }
  }
}
