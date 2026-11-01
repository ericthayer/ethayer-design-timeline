// Draft model, ops reducer, undo and redo (spec 004 edit-layer FR-383, T380).
import { describe, expect, it } from 'vitest';
import {
  type Draft,
  type History,
  UNDO_LIMIT,
  begin,
  canRedo,
  canUndo,
  changeCount,
  endGroup,
  redo,
  same,
  undo,
} from '../../../src/core/editor/draft.ts';
import {
  type EditOp,
  apply,
  commit,
  isTextPointer,
  parsePointer,
} from '../../../src/core/editor/ops.ts';
import { demoDraft, demoProject } from './fixtures.ts';

/** Applies an op that must succeed. */
function run(draft: Draft, op: EditOp): Draft {
  const result = apply(draft, op);
  if (!result.ok) throw new Error(result.reason);
  return result.draft;
}

function step(h: History, op: EditOp, group: string | null = null): History {
  const result = commit(h, op, group);
  if (!result.ok) throw new Error(result.reason);
  return result.draft;
}

const ops: readonly EditOp[] = [
  { kind: 'text', pointer: '/title', value: 'New' },
  { kind: 'text', pointer: '/tracklist/0/value', value: 'Lead' },
  { kind: 'settings', patch: { theme: 'navy', seed: 7, draft: true } },
  { kind: 'add', list: 'metrics', item: { value: '40%', label: 'Faster' } },
  { kind: 'add', list: 'tracklist', item: { label: 'Vue 3' }, at: 0 },
  { kind: 'move', list: 'tracklist', from: 0, to: 1 },
  { kind: 'remove', list: 'tracklist', index: 0 },
  { kind: 'set-item', list: 'tracklist', index: 0, item: { label: 'Vue' } },
  { kind: 'move-in-era', to: 2 },
  {
    kind: 'stage',
    file: {
      path: 'media-src/demo/a.png',
      key: 'demo/a',
      type: 'image/png',
      bytes: 9,
      width: 1,
      height: 1,
    },
  },
  { kind: 'unstage', path: 'media-src/demo/a.png' },
];

describe('text pointers (FR-386)', () => {
  it('accepts only the whitelisted inline fields', () => {
    for (const p of [
      '/title',
      '/summary',
      '/body/outcome',
      '/tracklist/3/value',
      '/metrics/0/label',
      '/gallery/12/label',
    ]) {
      expect(isTextPointer(p)).toBe(true);
    }
    for (const p of [
      '/slug',
      '/era',
      '/body',
      '/body/other',
      '/tracklist/01/label',
      '/gallery/0/media',
      '/links/0/label',
      'title',
      '',
    ]) {
      expect(parsePointer(p)).toBeNull();
    }
  });

  it('rejects an unknown pointer and an index past the list', () => {
    expect(apply(demoDraft(), { kind: 'text', pointer: '/slug', value: 'x' })).toEqual({
      ok: false,
      reason: 'unknown-pointer',
    });
    expect(apply(demoDraft(), { kind: 'text', pointer: '/metrics/0/label', value: 'x' })).toEqual({
      ok: false,
      reason: 'out-of-range',
    });
  });
});

describe('apply (FR-383)', () => {
  it('returns a new draft for every op and never mutates the old one', () => {
    let draft = demoDraft();
    for (const op of ops) {
      const frozen = structuredClone(draft);
      const next = run(draft, op);
      expect(next).not.toBe(draft);
      expect(draft).toEqual(frozen);
      draft = next;
    }
  });

  it('sets text, and an empty track value omits the key', () => {
    let d = run(demoDraft(), { kind: 'text', pointer: '/body/context', value: 'Why.' });
    expect(d.working.body.context).toBe('Why.');
    d = run(d, { kind: 'text', pointer: '/tracklist/0/value', value: 'Lead' });
    expect(d.working.tracklist[0]).toEqual({ label: 'TypeScript', value: 'Lead' });
    d = run(d, { kind: 'text', pointer: '/tracklist/0/value', value: '' });
    expect(d.working.tracklist[0]).toEqual({ label: 'TypeScript' });
  });

  it('omits an emptied optional list, a null seed, and a false draft flag', () => {
    let d = run(demoDraft(), {
      kind: 'add',
      list: 'links',
      item: { label: 'Live', href: 'https://x.dev', kind: 'live' },
    });
    d = run(d, { kind: 'settings', patch: { seed: 4, draft: true } });
    expect(d.working).toMatchObject({ seed: 4, draft: true, links: [{ label: 'Live' }] });
    d = run(d, { kind: 'remove', list: 'links', index: 0 });
    d = run(d, { kind: 'settings', patch: { seed: null, draft: false } });
    expect(Object.keys(d.working)).not.toEqual(expect.arrayContaining(['seed']));
    expect('links' in d.working || 'draft' in d.working).toBe(false);
  });

  it('moves the project to the top of a new era, and within its era', () => {
    const moved = run(demoDraft(), { kind: 'move-in-era', to: 3 });
    expect(moved.order.cobank).toEqual(['swiss-one', 'p2', 'p3', 'demo']);
    expect(apply(moved, { kind: 'move-in-era', to: 4 })).toEqual({
      ok: false,
      reason: 'out-of-range',
    });
    const era = run(demoDraft(), { kind: 'settings', patch: { era: 'dli' } });
    expect(era.order).toEqual({ cobank: ['swiss-one', 'p2', 'p3'], dli: ['demo'] });
  });

  it('replaces a staged file with the same path', () => {
    const file = {
      path: 'media-src/demo/a.png',
      key: 'demo/a',
      type: 'image/png',
      bytes: 1,
      width: 1,
      height: 1,
    };
    const d = run(run(demoDraft(), { kind: 'stage', file }), {
      kind: 'stage',
      file: { ...file, bytes: 2 },
    });
    expect(d.staged).toEqual([{ ...file, bytes: 2 }]);
  });
});

describe('changeCount (FR-383)', () => {
  it('is zero for an untouched draft, ignoring key order', () => {
    const { body, ...rest } = demoProject();
    expect(changeCount(demoDraft({ body, ...rest }))).toBe(0);
    expect(same({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
  });

  it('counts top-level fields, body paragraphs, gallery tiles, the order, and staged files', () => {
    let d = demoDraft();
    d = run(d, { kind: 'text', pointer: '/title', value: 'T' });
    d = run(d, { kind: 'text', pointer: '/body/context', value: 'A' });
    d = run(d, { kind: 'text', pointer: '/body/outcome', value: 'B' });
    expect(changeCount(d)).toBe(3);
    const tile = {
      media: { kind: 'placeholder', variant: 'site' },
      label: 'Placeholder · A',
    } as const;
    d = run(d, { kind: 'add', list: 'gallery', item: tile });
    d = run(d, { kind: 'add', list: 'gallery', item: tile });
    expect(changeCount(d)).toBe(5);
    d = run(d, { kind: 'move-in-era', to: 1 });
    d = run(d, {
      kind: 'stage',
      file: {
        path: 'media-src/demo/a.png',
        key: 'demo/a',
        type: 'image/png',
        bytes: 1,
        width: 1,
        height: 1,
      },
    });
    expect(changeCount(d)).toBe(7);
  });

  it('counts every field of a create draft against an empty base', () => {
    const d: Draft = { ...demoDraft(), action: 'create', base: { sha: 'b'.repeat(40), files: {} } };
    expect(changeCount(d)).toBe(Object.keys(d.working).length + 2 + 1);
  });
});

describe('undo and redo (FR-383)', () => {
  it(`keeps only the last ${UNDO_LIMIT} steps`, () => {
    let h = begin(demoDraft());
    for (let i = 1; i <= UNDO_LIMIT + 1; i += 1) {
      h = step(h, { kind: 'text', pointer: '/title', value: `T${i}` });
    }
    let undone = 0;
    while (canUndo(h)) {
      h = undo(h);
      undone += 1;
    }
    expect(undone).toBe(UNDO_LIMIT);
    expect(h.draft.working.title).toBe('T1');
  });

  it('groups text edits per field focus, and redo replays', () => {
    let h = begin(demoDraft());
    h = step(h, { kind: 'text', pointer: '/title', value: 'D' }, 'title');
    h = step(h, { kind: 'text', pointer: '/title', value: 'Do' }, 'title');
    h = step(h, { kind: 'text', pointer: '/title', value: 'Don' }, 'title');
    h = endGroup(h);
    h = step(h, { kind: 'text', pointer: '/title', value: 'Done' }, 'title');
    expect(h.past).toHaveLength(2);
    h = undo(h);
    expect(h.draft.working.title).toBe('Don');
    h = undo(h);
    expect(h.draft.working.title).toBe('Demo');
    expect(canRedo(h)).toBe(true);
    h = redo(redo(h));
    expect(h.draft.working.title).toBe('Done');
    expect(canRedo(h)).toBe(false);
  });

  it('a new step clears redo, and a rejected op leaves history alone', () => {
    let h = step(begin(demoDraft()), { kind: 'text', pointer: '/title', value: 'A' });
    h = step(undo(h), { kind: 'text', pointer: '/title', value: 'B' });
    expect(canRedo(h)).toBe(false);
    expect(commit(h, { kind: 'remove', list: 'tracklist', index: 9 })).toEqual({
      ok: false,
      reason: 'out-of-range',
    });
  });
});
