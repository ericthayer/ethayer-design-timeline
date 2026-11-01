// New project defaults, slug checks, and the create plan (spec 004 edit-layer FR-393, T391).
import { describe, expect, it } from 'vitest';
import { ERAS } from '../../../src/content/eras.ts';
import { CONTENT_FILES, projectFile, serialize } from '../../../src/content/paths.ts';
import { parseJson } from '../../../src/content/validate/index.ts';
import { type EditorContext, buildChanges } from '../../../src/core/editor/changes.ts';
import {
  createDraft,
  freeMotif,
  newProject,
  orderWith,
  renameCreate,
  slugProblem,
  thisMonth,
} from '../../../src/core/editor/create.ts';
import { baseBundle } from '../../fixtures/content/bundle.ts';
import { SHA } from './fixtures.ts';

const CTX: EditorContext = { frameOrigins: [], images: {}, videoKeys: new Set() };
const cobank = ERAS.find((e) => e.id === 'cobank') ?? ERAS[0];
const fields = { slug: 'acme', title: 'Acme portal', era: cobank, client: 'Acme', role: 'Lead' };
const ORDER = { cobank: ['demo', 'swiss-one', 'p2', 'p3'] };

describe('slugProblem (FR-393)', () => {
  const taken = new Set(['demo']);
  it.each([
    ['', 'Enter a slug.'],
    ['Acme', 'Use lowercase letters, digits, and single hyphens.'],
    ['acme--portal', 'Use lowercase letters, digits, and single hyphens.'],
    ['-acme', 'Use lowercase letters, digits, and single hyphens.'],
    ['demo', 'A project named demo already exists.'],
  ])('%j → %s', (slug, problem) => {
    expect(slugProblem(slug, taken)).toBe(problem);
  });
  it('accepts a new kebab slug', () => {
    expect(slugProblem('acme-portal-2', taken)).toBeNull();
  });
});

describe('newProject defaults (FR-393)', () => {
  it('fills the defaults around the form', () => {
    const p = newProject(fields, 'scatter', new Date(2026, 10, 1));
    expect(p).toMatchObject({
      slug: 'acme',
      engagement: cobank.engagement,
      period: { start: '2026-11', end: 'present' },
      size: 'sm',
      treatment: 'standard',
      layout: 'title-bottom',
      media: { kind: 'placeholder', variant: 'site' },
      theme: 'paper-ink',
      motif: 'scatter',
      tracklist: [],
      draft: true,
    });
    expect(thisMonth(new Date(2026, 0, 31))).toBe('2026-01');
  });

  it('picks the first motif no Swiss card uses', () => {
    expect(
      freeMotif([
        { treatment: 'swiss', motif: 'petals' },
        { treatment: 'standard', motif: 'eclipse' },
      ]),
    ).toBe('eclipse');
  });
});

describe('create drafts (FR-393, X4)', () => {
  const draft = createDraft(
    newProject(fields, 'scatter', new Date(2026, 10, 1)),
    SHA,
    ORDER,
    serialize(ORDER),
  );

  it('puts the project at index 0 of its era, once', () => {
    expect(draft.order).toEqual({ cobank: ['acme', 'demo', 'swiss-one', 'p2', 'p3'] });
    expect(orderWith(draft.order, 'cobank', 'acme')).toEqual(draft.order);
    expect(draft.base.files[projectFile('acme')]).toBeNull();
  });

  it('plans the project file and order.json', () => {
    const working = {
      ...draft.working,
      summary: 'A portal.',
      body: { context: 'Context.', contribution: 'Built it.', outcome: 'Shipped.' },
      tracklist: [{ label: 'TypeScript' }],
    };
    const built = buildChanges({ ...draft, working }, baseBundle(), CTX);
    expect(built.gate).not.toBe('blocked');
    expect(built.changes.map((c) => [c.kind, c.path])).toEqual([
      ['put', projectFile('acme')],
      ['put', CONTENT_FILES.order],
    ]);
    const order = built.changes.find((c) => c.path === CONTENT_FILES.order);
    if (order?.kind !== 'put') throw new Error('no order put');
    expect(parseJson(order.content)).toEqual({ cobank: ['acme', 'demo', 'swiss-one', 'p2', 'p3'] });
  });

  it('renames before the first publish', () => {
    const renamed = renameCreate(draft, 'acme-2');
    expect(renamed.slug).toBe('acme-2');
    expect(renamed.working.slug).toBe('acme-2');
    expect(renamed.order['cobank']?.[0]).toBe('acme-2');
    expect(renamed.order['cobank']).not.toContain('acme');
    expect(Object.keys(renamed.base.files)).toEqual([CONTENT_FILES.order, projectFile('acme-2')]);
  });
});
