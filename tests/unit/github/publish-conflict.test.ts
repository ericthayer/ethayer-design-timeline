import { afterEach, describe, expect, it } from 'vitest';
import { publish } from '../../../src/core/github/publish.ts';
import type { FileChange, PublishRequest } from '../../../src/core/github/types.ts';
import {
  BASE_TREE,
  C2,
  commitBody,
  fakeGitHub,
  H0,
  H1,
  publishScript,
  T1,
  type Script,
} from './fake-github.ts';
import notFastForward from './fixtures/error-not-fast-forward.json';

const JSON_PATH = 'src/content/data/projects/dmns.json';
const CHANGES: FileChange[] = [
  { kind: 'put', path: JSON_PATH, content: '{"slug":"dmns"}\n' },
  { kind: 'put-binary', path: 'media-src/dmns/cover.webp', bytes: new Uint8Array([1, 2, 3]) },
];
const request = (changes: readonly FileChange[] = CHANGES): PublishRequest => ({
  changes,
  message: 'content: update dmns via admin',
  expectedHeadSha: H0,
});
const COMPARE = `GET /compare/${H0}...${H1}`;
const RACE = { status: 422, body: notFastForward };

/** `main` moved from H0 to H1 (tree T1); `files` is what changed in between. */
const moved = (
  files: readonly { filename: string; previous_filename?: string }[],
  status = 'ahead',
): Script =>
  publishScript({
    'GET /git/ref/heads/main': { body: { object: { sha: H1 } } },
    [COMPARE]: { body: { status, files } },
    [`GET /git/commits/${H1}`]: { body: commitBody(H1, T1) },
    [`GET /git/trees/${T1}?recursive=1`]: {
      body: { sha: T1, truncated: false, tree: BASE_TREE },
    },
  });

afterEach(() => {
  sessionStorage.clear();
});

describe('rebase (FR-369)', () => {
  it('builds on the new head when no changed path was touched', async () => {
    const gh = fakeGitHub(moved([{ filename: 'src/content/data/projects/other.json' }]));
    expect(await publish(gh.session, request())).toMatchObject({
      kind: 'ok',
      commitSha: C2,
      rebased: true,
    });
    expect(gh.keys().slice(0, 3)).toEqual([
      'GET /git/ref/heads/main',
      COMPARE,
      `GET /git/commits/${H1}`,
    ]);
    const body = (key: string): unknown => gh.calls.find((c) => c.key === key)?.body;
    expect(body('POST /git/trees')).toMatchObject({ base_tree: T1 });
    expect(body('POST /git/commits')).toMatchObject({ parents: [H1] });
  });
});

describe('conflict (FR-369)', () => {
  it.each<[string, Script, PublishRequest, Record<string, unknown>]>([
    [
      'a changed path',
      moved([{ filename: JSON_PATH }]),
      request(),
      { reason: 'paths-changed', paths: [JSON_PATH] },
    ],
    [
      'a rename away from a changed path',
      moved([
        { filename: 'media-src/x/cover.webp', previous_filename: 'media-src/dmns/cover.webp' },
      ]),
      request(),
      { reason: 'paths-changed', paths: ['media-src/dmns/cover.webp'] },
    ],
    [
      'a file under a delete-dir folder',
      moved([{ filename: 'media-src/dmns/new.jpg' }]),
      request([{ kind: 'delete-dir', path: 'media-src/dmns/' }]),
      { reason: 'paths-changed', paths: ['media-src/dmns/new.jpg'] },
    ],
    ['rewritten history', moved([], 'diverged'), request(), { reason: 'history-diverged' }],
    [
      'a truncated compare',
      moved(Array.from({ length: 300 }, (_, i) => ({ filename: `f${i}` }))),
      request(),
      { reason: 'compare-truncated' },
    ],
  ])('%s writes nothing', async (_name, script, req, expected) => {
    const gh = fakeGitHub(script);
    expect(await publish(gh.session, req)).toMatchObject({
      kind: 'conflict',
      headSha: H1,
      ...expected,
    });
    expect(gh.keys()).toEqual(['GET /git/ref/heads/main', COMPARE]);
  });
});

describe('ref race (FR-370)', () => {
  it('retries once from a fresh head and reuses the uploaded blobs', async () => {
    const script = moved([{ filename: 'src/content/data/projects/other.json' }]);
    const gh = fakeGitHub({
      ...script,
      'GET /git/ref/heads/main': [
        { body: { object: { sha: H0 } } },
        { body: { object: { sha: H1 } } },
      ],
      [`GET /git/commits/${H0}`]: { body: commitBody(H0, 'e'.repeat(40)) },
      'PATCH /git/refs/heads/main': [RACE, { body: { object: { sha: C2 } } }],
    });
    expect(await publish(gh.session, request())).toMatchObject({ kind: 'ok', rebased: true });
    const keys = gh.keys();
    expect(keys.filter((k) => k === 'POST /git/blobs')).toHaveLength(CHANGES.length);
    expect(keys.filter((k) => k === 'PATCH /git/refs/heads/main')).toHaveLength(2);
    expect(keys).toContain(COMPARE);
    const commits = gh.calls.filter((c) => c.key === 'POST /git/commits').map((c) => c.body);
    expect(commits).toMatchObject([{ parents: [H0] }, { parents: [H1] }]);
    for (const call of gh.calls.filter((c) => c.method === 'PATCH')) {
      expect(call.body).toMatchObject({ force: false });
    }
  });

  it('gives up after a second race', async () => {
    const gh = fakeGitHub(publishScript({ 'PATCH /git/refs/heads/main': RACE }));
    expect(await publish(gh.session, request())).toEqual({
      kind: 'conflict',
      reason: 'race',
      paths: [],
      headSha: H0,
    });
    expect(gh.keys().filter((k) => k === 'PATCH /git/refs/heads/main')).toHaveLength(2);
    expect(gh.keys().filter((k) => k === 'POST /git/blobs')).toHaveLength(CHANGES.length);
  });
});
