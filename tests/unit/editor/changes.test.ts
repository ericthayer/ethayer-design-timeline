// Changes builder (spec 004 edit-layer FR-392–FR-395, §7, T382).
import { describe, expect, it } from 'vitest';
import {
  type EditorContext,
  buildChanges,
  buildDelete,
  validationContext,
} from '../../../src/core/editor/changes.ts';
import type { Draft } from '../../../src/core/editor/draft.ts';
import { apply, type EditOp } from '../../../src/core/editor/ops.ts';
import { CONTENT_FILES, projectFile, serialize } from '../../../src/content/paths.ts';
import { parseJson } from '../../../src/content/validate/index.ts';
import { baseBundle } from '../../fixtures/content/bundle.ts';
import { baseProject } from '../../fixtures/content/projects.ts';
import { demoDraft, demoProject } from './fixtures.ts';

const entry = (
  source: string,
): { width: number; height: number; widths: number[]; source: string } => ({
  width: 1600,
  height: 1000,
  widths: [480, 960, 1440],
  source,
});

const CTX: EditorContext = {
  frameOrigins: ['https://demo.netlify.app'],
  images: {
    'demo/cover': entry('cover.webp'),
    'demo/shot': entry('shot.jpg'),
    'p2/cover': entry('cover.png'),
  },
  videoKeys: new Set(['demo/clip']),
};

function run(draft: Draft, ...ops: EditOp[]): Draft {
  return ops.reduce((d, op) => {
    const r = apply(d, op);
    if (!r.ok) throw new Error(r.reason);
    return r.draft;
  }, draft);
}

const kinds = (b: { changes: readonly { kind: string; path: string }[] }): string[][] =>
  b.changes.map((c) => [c.kind, c.path]);

const image = (src: string) => ({ kind: 'image', src, alt: 'Alt text' }) as const;

describe('buildChanges (FR-393, FR-395)', () => {
  it('a title edit gives one put of the project file', () => {
    const built = buildChanges(
      run(demoDraft(), { kind: 'text', pointer: '/title', value: 'New' }),
      baseBundle(),
      CTX,
    );
    expect(built.gate).toBe('go');
    expect(kinds(built)).toEqual([['put', projectFile('demo')]]);
    const put = built.changes[0];
    expect(put?.kind === 'put' && parseJson(put.content)).toMatchObject({ title: 'New' });
  });

  it('an untouched draft gives no changes, and an order-only move gives only order.json', () => {
    expect(buildChanges(demoDraft(), baseBundle(), CTX).changes).toEqual([]);
    const moved = buildChanges(run(demoDraft(), { kind: 'move-in-era', to: 2 }), baseBundle(), CTX);
    expect(moved.changes).toEqual([
      {
        kind: 'put',
        path: CONTENT_FILES.order,
        content: serialize({ cobank: ['swiss-one', 'p2', 'demo', 'p3'] }),
      },
    ]);
  });

  it('a create gives the file plus order.json, at the top of its era', () => {
    const working = demoProject({ slug: 'new-one' });
    const draft: Draft = {
      ...demoDraft(working),
      action: 'create',
      base: { sha: 'b'.repeat(40), files: {} },
      order: { cobank: ['new-one', 'demo', 'swiss-one', 'p2', 'p3'] },
    };
    const built = buildChanges(draft, baseBundle(), CTX);
    expect(kinds(built)).toEqual([
      ['put', projectFile('new-one')],
      ['put', CONTENT_FILES.order],
    ]);
    const order = built.changes[1];
    expect(order?.kind === 'put' && parseJson(order.content)).toEqual({
      cobank: ['new-one', 'demo', 'swiss-one', 'p2', 'p3'],
    });
  });

  it('errors always give blocked and no changes', () => {
    const media = {
      kind: 'iframe',
      src: 'https://demo.netlify.app/',
      title: 'Demo',
      viewport: 'desktop',
      poster: image('demo/cover'),
    } as const;
    const draft = run(demoDraft(), { kind: 'settings', patch: { media } });
    const built = buildChanges(draft, baseBundle(), CTX);
    expect(built.gate).toBe('blocked');
    expect(built.changes).toEqual([]);
    expect(built.issues.some((i) => i.severity === 'error' && i.rule === 'size-media')).toBe(true);
  });

  it('warnings give confirm and keep the changes', () => {
    const draft = run(demoDraft(), {
      kind: 'settings',
      patch: { treatment: 'swiss', motif: 'eclipse' },
    });
    const built = buildChanges(draft, baseBundle(), CTX);
    expect(built.gate).toBe('confirm');
    expect(built.changes).toHaveLength(1);
  });
});

describe('media changes (FR-392)', () => {
  const withCover = (): Draft => demoDraft(demoProject({ media: image('demo/cover') }));
  const raw = (): Record<string, unknown> =>
    baseBundle({ demo: baseProject('demo', { media: image('demo/cover') }) });

  it('a same-key replace with a new extension gives put-media plus the old source delete', () => {
    const draft = run(withCover(), {
      kind: 'stage',
      file: {
        path: 'media-src/demo/cover.png',
        key: 'demo/cover',
        type: 'image/png',
        bytes: 9,
        width: 1600,
        height: 1000,
      },
    });
    expect(kinds(buildChanges(draft, raw(), CTX))).toEqual([
      ['put-media', 'media-src/demo/cover.png'],
      ['delete', 'media-src/demo/cover.webp'],
    ]);
  });

  it('a staged file no field references is not sent', () => {
    const draft = run(demoDraft(), {
      kind: 'stage',
      file: {
        path: 'media-src/demo/loose.png',
        key: 'demo/loose',
        type: 'image/png',
        bytes: 9,
        width: 1600,
        height: 1000,
      },
    });
    expect(buildChanges(draft, baseBundle(), CTX).changes).toEqual([]);
  });

  it('a new tile with a staged image validates against the staged key', () => {
    const draft = run(
      demoDraft(),
      {
        kind: 'stage',
        file: {
          path: 'media-src/demo/new.png',
          key: 'demo/new',
          type: 'image/png',
          bytes: 9,
          width: 1600,
          height: 1000,
        },
      },
      { kind: 'add', list: 'gallery', item: { media: image('demo/new'), label: 'New shot' } },
    );
    const built = buildChanges(draft, baseBundle(), CTX);
    expect(built.gate).toBe('go');
    expect(kinds(built)).toEqual([
      ['put', projectFile('demo')],
      ['put-media', 'media-src/demo/new.png'],
    ]);
  });

  it('a removed tile deletes only keys nothing references any more', () => {
    const gallery = [
      { media: image('demo/shot'), label: 'Shot' },
      { media: image('demo/cover'), label: 'Cover again' },
    ];
    const base = demoProject({ media: image('demo/cover'), gallery });
    const bundle = baseBundle({
      demo: baseProject('demo', { media: image('demo/cover'), gallery }),
    });
    const draft = run(
      demoDraft(base),
      { kind: 'remove', list: 'gallery', index: 1 },
      { kind: 'remove', list: 'gallery', index: 0 },
    );
    expect(kinds(buildChanges(draft, bundle, CTX))).toEqual([
      ['put', projectFile('demo')],
      ['delete', 'media-src/demo/shot.jpg'],
    ]);
  });

  it('ctx keys are manifest ∪ staged − deleted, and a clip needs both formats', () => {
    const staged = [
      {
        path: 'media-src/demo/a.png',
        key: 'demo/a',
        type: 'image/png',
        bytes: 1,
        width: 1,
        height: 1,
      },
      {
        path: 'media-src/demo/v.mp4',
        key: 'demo/v',
        type: 'video/mp4',
        bytes: 1,
        width: null,
        height: null,
      },
      {
        path: 'media-src/demo/w.mp4',
        key: 'demo/w',
        type: 'video/mp4',
        bytes: 1,
        width: null,
        height: null,
      },
      {
        path: 'media-src/demo/w.webm',
        key: 'demo/w',
        type: 'video/webm',
        bytes: 1,
        width: null,
        height: null,
      },
    ];
    const v = validationContext(CTX, staged, (k) => k.startsWith('p2/'));
    expect([...(v.mediaKeys ?? [])].sort()).toEqual(['demo/a', 'demo/cover', 'demo/shot']);
    expect([...(v.videoKeys ?? [])].sort()).toEqual(['demo/clip', 'demo/w']);
    expect(validationContext({ ...CTX, images: null, videoKeys: null }, staged)).toMatchObject({
      mediaKeys: null,
      videoKeys: null,
    });
  });
});

describe('buildDelete (FR-394)', () => {
  it('gives delete + order.json put + delete-dir', () => {
    expect(kinds(buildDelete(baseBundle(), 'p2', CTX))).toEqual([
      ['delete', projectFile('p2')],
      ['put', CONTENT_FILES.order],
      ['delete-dir', 'media-src/p2/'],
    ]);
  });

  it('is blocked when another project uses a key under the folder, and names it', () => {
    const bundle = baseBundle({ p3: baseProject('p3', { media: image('p2/cover') }) });
    const built = buildDelete(bundle, 'p2', CTX);
    expect(built.gate).toBe('blocked');
    expect(built.changes).toEqual([]);
    expect(built.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'media-key', file: projectFile('p3') }),
      ]),
    );
  });
});
