// Inline text fields: the pointer whitelist and text writes (spec 004 edit-layer FR-383, FR-386).
// Pure.
import type { TrackItem } from '../../content/types.ts';
import type { EditableProject } from './draft.ts';
import { replaceAt, withList } from './lists.ts';

// ---- Text pointers: the whitelist of inline fields (FR-386) ----

type BodyKey = 'context' | 'contribution' | 'outcome';
export type TextPointer =
  | '/title'
  | '/summary'
  | `/body/${BodyKey}`
  | `/tracklist/${number}/${'label' | 'value'}`
  | `/metrics/${number}/${'value' | 'label'}`
  | `/gallery/${number}/label`;

export type TextTarget =
  | { readonly field: 'title' | 'summary' }
  | { readonly field: 'body'; readonly key: BodyKey }
  | { readonly field: 'tracklist'; readonly index: number; readonly key: 'label' | 'value' }
  | { readonly field: 'metrics'; readonly index: number; readonly key: 'value' | 'label' }
  | { readonly field: 'gallery'; readonly index: number; readonly key: 'label' };

const POINTER =
  /^\/(?:(title|summary)|body\/(context|contribution|outcome)|(tracklist)\/(0|[1-9]\d*)\/(label|value)|(metrics)\/(0|[1-9]\d*)\/(value|label)|(gallery)\/(0|[1-9]\d*)\/(label))$/;

/** The whitelisted text field a pointer names, or null for any other pointer. */
export function parsePointer(pointer: string): TextTarget | null {
  const m = POINTER.exec(pointer);
  if (m === null) return null;
  const [, top, body, , ti, tk, , mi, mk, , gi] = m;
  if (top === 'title' || top === 'summary') return { field: top };
  if (body === 'context' || body === 'contribution' || body === 'outcome') {
    return { field: 'body', key: body };
  }
  if (ti !== undefined && (tk === 'label' || tk === 'value')) {
    return { field: 'tracklist', index: Number(ti), key: tk };
  }
  if (mi !== undefined && (mk === 'label' || mk === 'value')) {
    return { field: 'metrics', index: Number(mi), key: mk };
  }
  if (gi !== undefined) return { field: 'gallery', index: Number(gi), key: 'label' };
  return null;
}

export const isTextPointer = (pointer: string): pointer is TextPointer =>
  parsePointer(pointer) !== null;

// ---- Text ----

function setTrack(item: TrackItem, key: 'label' | 'value', value: string): TrackItem {
  if (key === 'label') return { ...item, label: value };
  const { value: _old, ...rest } = item;
  return value === '' ? rest : { ...rest, value };
}

export function setText(p: EditableProject, t: TextTarget, value: string): EditableProject | null {
  switch (t.field) {
    case 'title':
      return { ...p, title: value };
    case 'summary':
      return { ...p, summary: value };
    case 'body':
      return { ...p, body: { ...p.body, [t.key]: value } };
    case 'tracklist': {
      const item = p.tracklist[t.index];
      if (item === undefined) return null;
      const items = replaceAt(p.tracklist, t.index, setTrack(item, t.key, value));
      return withList(p, { list: 'tracklist', items });
    }
    case 'metrics': {
      const all = p.metrics ?? [];
      const item = all[t.index];
      if (item === undefined) return null;
      const items = replaceAt(all, t.index, { ...item, [t.key]: value });
      return withList(p, { list: 'metrics', items });
    }
    case 'gallery': {
      const all = p.gallery ?? [];
      const item = all[t.index];
      if (item === undefined) return null;
      const items = replaceAt(all, t.index, { ...item, label: value });
      return withList(p, { list: 'gallery', items });
    }
  }
}
