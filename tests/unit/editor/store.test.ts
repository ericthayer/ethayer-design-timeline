// Snapshot and draft store (spec 004 edit-layer FR-384, FR-385, T384).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type Backend,
  DraftStore,
  isDraft,
  memoryBackend,
} from '../../../src/admin/edit/draft-store.ts';
import {
  type Bundled,
  type Reader,
  draftFrom,
  takeSnapshot,
} from '../../../src/admin/edit/snapshot.ts';
import type { AdminSession } from '../../../src/core/auth/session.ts';
import type { ReadFileResult } from '../../../src/core/github/types.ts';
import { CONTENT_FILES, projectFile, serialize } from '../../../src/content/paths.ts';
import type { Project } from '../../../src/content/types.ts';
import { baseEras, baseResume, baseSite } from '../../fixtures/content/documents.ts';
import { CTX } from '../../fixtures/content/projects.ts';
import { ORDER, SHA, demoDraft, demoProject } from './fixtures.ts';

afterEach(() => {
  vi.useRealTimers();
});

/** Records every value written, so a test can scan them. */
function spyBackend(inner: Backend = memoryBackend()): Backend & { written: unknown[] } {
  const written: unknown[] = [];
  return {
    ...inner,
    written,
    put: (store, key, value) => {
      written.push(value);
      return inner.put(store, key, value);
    },
  };
}

const throwing: Backend = {
  get: () => Promise.reject(new Error('quota')),
  put: () => Promise.reject(new Error('quota')),
  delete: () => Promise.reject(new Error('quota')),
  keys: () => Promise.reject(new Error('quota')),
};

describe('DraftStore (FR-385)', () => {
  it('debounces saves by 500 ms and keeps the last draft', async () => {
    vi.useFakeTimers();
    const backend = spyBackend();
    const store = new DraftStore(backend, true, { now: () => 1000 });
    store.save(demoDraft(demoProject({ title: 'One' })));
    store.save(demoDraft(demoProject({ title: 'Two' })));
    await vi.advanceTimersByTimeAsync(499);
    expect(backend.written).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(backend.written).toHaveLength(1);
    expect((await store.load('demo'))?.working.title).toBe('Two');
  });

  it('never writes a token or session field', async () => {
    const backend = spyBackend();
    const store = new DraftStore(backend, true);
    await store.write(demoDraft());
    await store.putBlob('media-src/demo/a.png', new Blob(['x']));
    const text = JSON.stringify(backend.written);
    for (const word of ['token', 'session', 'authorization', 'github_pat', 'login']) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });

  it('falls back to memory with a warning when the store throws', async () => {
    const problems: string[] = [];
    const store = new DraftStore(throwing, true, { onProblem: (p) => problems.push(p) });
    expect(await store.write(demoDraft())).toBe('saved');
    expect(store.persistent).toBe(false);
    expect(problems).toEqual(['fallback']);
    expect((await store.load('demo'))?.slug).toBe('demo');
  });

  it('refuses to overwrite a newer copy from another tab', async () => {
    const backend = memoryBackend();
    const problems: string[] = [];
    const tabA = new DraftStore(backend, true, {
      now: () => 100,
      onProblem: (p) => problems.push(p),
    });
    const tabB = new DraftStore(backend, true, { now: () => 200 });
    expect(await tabA.write(demoDraft())).toBe('saved');
    await tabB.load('demo');
    expect(await tabB.write(demoDraft(demoProject({ title: 'B' })))).toBe('saved');
    expect(await tabA.write(demoDraft(demoProject({ title: 'A' })))).toBe('conflict');
    expect(problems).toEqual(['conflict']);
    expect((await tabA.load('demo'))?.working.title).toBe('B');
  });

  it('keeps one key per slug, lists slugs, and clears drafts and blobs', async () => {
    const backend = memoryBackend();
    const store = new DraftStore(backend, true);
    await store.write(demoDraft());
    const newer = { ...demoDraft(), base: { ...demoDraft().base, sha: 'b'.repeat(40) } };
    await store.write(newer);
    expect(await backend.keys('drafts')).toEqual([['demo', 'b'.repeat(40)]]);
    await store.write(demoDraft(demoProject({ slug: 'other' })));
    expect(await store.slugs()).toEqual(['demo', 'other']);
    const file = {
      path: 'media-src/demo/a.png',
      key: 'demo/a',
      type: 'image/png',
      bytes: 1,
      width: 1,
      height: 1,
    };
    await store.putBlob(file.path, new Blob(['x']));
    expect(await store.getBlob(file.path)).toBeInstanceOf(Blob);
    await store.clear('demo', [file]);
    expect(await store.slugs()).toEqual(['other']);
    expect(await store.getBlob(file.path)).toBeNull();
  });

  it('ignores stored values that are not drafts', async () => {
    const backend = memoryBackend();
    await backend.put('drafts', ['demo', SHA], { v: 2, slug: 'demo' });
    expect(await new DraftStore(backend, true).load('demo')).toBeNull();
    expect(isDraft(demoDraft())).toBe(true);
    expect(isDraft({ ...demoDraft(), staged: [{ path: 1 }] })).toBe(false);
  });
});

// ---- Snapshot ----

const session: AdminSession = {
  login: 'ericthayer',
  repo: { owner: 'o', name: 'r', branch: 'main' },
  expiresAt: null,
  authorizedFetch: () => Promise.reject(new Error('not used')),
};

function fakeReader(files: Record<string, string>, head = SHA): Reader & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    readHead: () => Promise.resolve({ kind: 'ok', sha: head }),
    readFile: (_s, path, ref): Promise<ReadFileResult> => {
      reads.push(`${path}@${ref}`);
      const text = files[path];
      return Promise.resolve(
        text === undefined ? { kind: 'not-found' } : { kind: 'ok', text, blobSha: 'x' },
      );
    },
  };
}

const others = (): Project[] =>
  ['swiss-one', 'p2', 'p3'].map((slug) => ({
    ...demoProject({
      slug,
      ...(slug === 'swiss-one' ? { treatment: 'swiss', motif: 'eclipse' } : {}),
    }),
    size: 'sm',
    media: { kind: 'placeholder', variant: 'site' },
  }));

const bundled = (
  demo: Project = { ...demoProject(), size: 'sm', media: { kind: 'placeholder', variant: 'site' } },
): Bundled => ({
  projects: [demo, ...others()],
  order: ORDER,
  eras: baseEras(),
  site: baseSite(),
  resume: baseResume(),
});

describe('takeSnapshot (FR-384)', () => {
  const repo = (title = 'Demo'): Record<string, string> => ({
    [projectFile('demo')]: serialize(demoProject({ title })),
    [CONTENT_FILES.order]: serialize(ORDER),
  });

  it('reads the head, then the project and order.json at that sha', async () => {
    const reader = fakeReader(repo());
    const snap = await takeSnapshot(session, 'demo', bundled(), CTX, reader);
    if (snap.kind !== 'ok') throw new Error(snap.kind);
    expect(reader.reads).toEqual([
      `${projectFile('demo')}@${SHA}`,
      `${CONTENT_FILES.order}@${SHA}`,
    ]);
    expect(snap.behind).toBe(false);
    expect(snap.invalid).toBeNull();
    expect(Object.keys(snap.raw)).toContain(projectFile('p2'));
    expect(draftFrom('demo', snap)).toMatchObject({
      action: 'update',
      base: { sha: SHA },
      order: ORDER,
    });
  });

  it('says when the live site is behind the repository', async () => {
    const snap = await takeSnapshot(session, 'demo', bundled(), CTX, fakeReader(repo('Newer')));
    expect(snap.kind === 'ok' && snap.behind).toBe(true);
    expect(snap.kind === 'ok' && snap.project?.title).toBe('Newer');
  });

  it('reads a listed project the bundle lacks from the repository', async () => {
    const order = { cobank: [...ORDER.cobank, 'fresh'] };
    const files = {
      ...repo(),
      [CONTENT_FILES.order]: serialize(order),
      [projectFile('fresh')]: serialize(demoProject({ slug: 'fresh' })),
    };
    const reader = fakeReader(files);
    const snap = await takeSnapshot(session, 'demo', bundled(), CTX, reader);
    expect(reader.reads).toContain(`${projectFile('fresh')}@${SHA}`);
    expect(snap.kind === 'ok' && snap.behind).toBe(true);
  });

  it('opens read-only with the issues when the repo file is invalid', async () => {
    const files = {
      ...repo(),
      [projectFile('demo')]: serialize({ ...demoProject(), theme: 'neon' }),
    };
    const snap = await takeSnapshot(session, 'demo', bundled(), CTX, fakeReader(files));
    if (snap.kind !== 'ok') throw new Error(snap.kind);
    expect(snap.invalid?.map((i) => i.rule)).toContain('theme-name');
    expect(draftFrom('demo', snap)).toBeNull();
  });

  it('passes GitHub failures through', async () => {
    const reader: Reader = {
      ...fakeReader({}),
      readHead: () => Promise.resolve({ kind: 'network' }),
    };
    expect(await takeSnapshot(session, 'demo', bundled(), CTX, reader)).toEqual({
      kind: 'failed',
      error: { kind: 'network' },
    });
  });
});
