// Change plans for the editor (spec 004 content-json, FR-309, US21).
import { describe, expect, it } from 'vitest';
import {
  type ContentChange,
  planCreate,
  planDelete,
  planReorder,
  planUpdate,
} from '../../src/content/changes.ts';
import { CONTENT_FILES, projectFile, serialize } from '../../src/content/paths.ts';
import { parseJson, validateContent } from '../../src/content/validate/index.ts';
import { baseBundle } from '../fixtures/content/bundle.ts';
import { CTX, baseProject } from '../fixtures/content/projects.ts';

type Raw = Record<string, unknown>;

/** Applies a plan's changes to the raw content, as a commit would. */
function apply(raw: Raw, changes: readonly ContentChange[]): Raw {
  const next = { ...raw };
  for (const change of changes) {
    if (change.kind === 'put') next[change.path] = parseJson(change.content);
    else next[change.path] = undefined;
  }
  return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
}

const orderOf = (raw: Raw): unknown => raw[CONTENT_FILES.order];

describe('planCreate', () => {
  it('adds one file and one order.json change, at index `at` of the era', () => {
    const raw = baseBundle();
    const result = planCreate(raw, baseProject('new-one'), 1, CTX);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.value.map((c) => [c.kind, c.path])).toEqual([
      ['put', projectFile('new-one')],
      ['put', CONTENT_FILES.order],
    ]);
    const next = apply(raw, result.value);
    expect(orderOf(next)).toEqual({ cobank: ['demo', 'new-one', 'swiss-one', 'p2', 'p3'] });
    expect(validateContent(next, CTX).ok).toBe(true);
  });

  it('appends when `at` is past the end, and writes with serialize', () => {
    const result = planCreate(baseBundle(), baseProject('last'), 99, CTX);
    if (!result.ok) throw new Error('expected ok');
    const put = result.value.find((c) => c.path === CONTENT_FILES.order);
    expect(put).toEqual({
      kind: 'put',
      path: CONTENT_FILES.order,
      content: serialize({ cobank: ['demo', 'swiss-one', 'p2', 'p3', 'last'] }),
    });
  });

  it('rejects an existing slug and an invalid project with no changes', () => {
    const taken = planCreate(baseBundle(), baseProject('p2'), 0, CTX);
    expect(taken.ok ? [] : taken.errors.map((i) => i.rule)).toEqual(['slug']);
    const invalid = planCreate(baseBundle(), baseProject('bad', { theme: 'neon' }), 0, CTX);
    expect(invalid.ok).toBe(false);
    expect('value' in invalid).toBe(false);
  });
});

describe('planUpdate', () => {
  it('changes only the project file when the era stays', () => {
    const result = planUpdate(baseBundle(), 'p2', baseProject('p2', { title: 'Renamed' }), CTX);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.map((c) => c.path)).toEqual([projectFile('p2')]);
  });

  it('rejects a slug change (slugs are immutable, D6)', () => {
    const result = planUpdate(baseBundle(), 'p2', baseProject('p2-new'), CTX);
    expect(result.ok ? [] : result.errors.map((i) => [i.rule, i.file, i.path])).toEqual([
      ['slug', projectFile('p2'), '/slug'],
    ]);
  });

  it('moves a project to the top of its new era in order.json', () => {
    const raw = baseBundle();
    const result = planUpdate(raw, 'p3', baseProject('p3', { era: 'independent' }), CTX);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(orderOf(apply(raw, result.value))).toEqual({
      cobank: ['demo', 'swiss-one', 'p2'],
      independent: ['p3'],
    });
  });
});

describe('planDelete', () => {
  it('removes the file and its order.json entry together', () => {
    const raw = baseBundle();
    const result = planDelete(raw, 'p2', CTX);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value).toContainEqual({ kind: 'delete', path: projectFile('p2') });
    const next = apply(raw, result.value);
    expect(orderOf(next)).toEqual({ cobank: ['demo', 'swiss-one', 'p3'] });
    expect(Object.hasOwn(next, projectFile('p2'))).toBe(false);
  });

  it('deleting the last Swiss card is a warning, not an error (FR-312)', () => {
    const result = planDelete(baseBundle(), 'swiss-one', CTX);
    expect(result.ok).toBe(true);
    expect(result.warnings.map((i) => i.rule)).toEqual(['swiss-share']);
  });

  it('rejects an unknown slug', () => {
    expect(planDelete(baseBundle(), 'ghost', CTX).ok).toBe(false);
  });
});

describe('planReorder', () => {
  it('changes only order.json', () => {
    const result = planReorder(baseBundle(), 'cobank', ['p3', 'p2', 'swiss-one', 'demo'], CTX);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.map((c) => c.path)).toEqual([CONTENT_FILES.order]);
  });

  it('reports a dangling or dropped slug as an `order` error, with no changes', () => {
    const dangling = planReorder(baseBundle(), 'cobank', ['demo', 'swiss-one', 'ghost'], CTX);
    expect(dangling.ok ? [] : [...new Set(dangling.errors.map((i) => i.rule))]).toEqual(['order']);
    expect('value' in dangling).toBe(false);
  });
});
