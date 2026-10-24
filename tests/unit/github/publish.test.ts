import { afterEach, describe, expect, it } from 'vitest';
import { publish } from '../../../src/core/github/publish.ts';
import { toBase64 } from '../../../src/core/github/tree.ts';
import type { FileChange, PublishRequest } from '../../../src/core/github/types.ts';
import { blobStep, C2, fakeGitHub, fakeSha, H0, publishScript, T0, T2 } from './fake-github.ts';

const JSON_PATH = 'src/content/data/projects/dmns.json';
const IMAGE_PATH = 'media-src/dmns/cover.webp';
const IMAGE = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 1, 2, 3, 255]);
const CONTENT = '{\n  "slug": "dmns",\n  "title": "Café"\n}\n';

const request = (
  changes: readonly FileChange[],
  over: Partial<PublishRequest> = {},
): PublishRequest => ({
  changes,
  message: 'content: update dmns via admin',
  expectedHeadSha: H0,
  ...over,
});

const THREE: FileChange[] = [
  { kind: 'put', path: JSON_PATH, content: CONTENT },
  { kind: 'put-binary', path: IMAGE_PATH, bytes: IMAGE },
  { kind: 'delete', path: 'src/content/data/projects/old.json' },
];

afterEach(() => {
  sessionStorage.clear();
});

describe('publish happy path (FR-365, FR-366, FR-371)', () => {
  it('makes one commit on the previous head, in the documented order', async () => {
    const gh = fakeGitHub(publishScript());
    const result = await publish(gh.session, request(THREE));
    expect(result).toEqual({
      kind: 'ok',
      commitSha: C2,
      commitUrl: `https://github.com/ericthayer/ethayer-design-timeline/commit/${C2}`,
      rebased: false,
    });
    expect(gh.keys()).toEqual([
      'GET /git/ref/heads/main',
      `GET /git/commits/${H0}`,
      `GET /git/trees/${T0}?recursive=1`,
      'POST /git/blobs',
      'POST /git/blobs',
      'POST /git/trees',
      'POST /git/commits',
      'PATCH /git/refs/heads/main',
    ]);
    const body = (key: string): unknown => gh.calls.find((c) => c.key === key)?.body;
    const blobs = gh.calls.filter((c) => c.key === 'POST /git/blobs').map((c) => c.body);
    expect(blobs).toEqual(
      expect.arrayContaining([
        { content: CONTENT, encoding: 'utf-8' },
        { content: toBase64(IMAGE), encoding: 'base64' },
      ]),
    );
    expect(body('POST /git/trees')).toEqual({
      base_tree: T0,
      tree: [
        { path: IMAGE_PATH, mode: '100644', type: 'blob', sha: fakeSha(toBase64(IMAGE)) },
        { path: JSON_PATH, mode: '100644', type: 'blob', sha: fakeSha(CONTENT) },
        {
          path: 'src/content/data/projects/old.json',
          mode: '100644',
          type: 'blob',
          sha: null,
        },
      ],
    });
    expect(body('POST /git/commits')).toEqual({
      message: 'content: update dmns via admin\n\nPublished-With: admin editor',
      tree: T2,
      parents: [H0],
    });
    expect(body('PATCH /git/refs/heads/main')).toEqual({ sha: C2, force: false });
  });

  it('makes 5 + N requests for N puts and no deletions', async () => {
    const gh = fakeGitHub(publishScript());
    const puts: FileChange[] = [
      { kind: 'put', path: JSON_PATH, content: CONTENT },
      { kind: 'put', path: 'src/content/data/order.json', content: '{}\n' },
    ];
    expect(await publish(gh.session, request(puts))).toMatchObject({ kind: 'ok' });
    expect(gh.calls).toHaveLength(5 + 2);
  });

  it('keeps at most 3 blob uploads in flight', async () => {
    const gh = fakeGitHub(publishScript());
    const puts: FileChange[] = Array.from({ length: 8 }, (_, i) => ({
      kind: 'put',
      path: `src/content/data/projects/p${i}.json`,
      content: `{"i":${i}}`,
    }));
    expect(await publish(gh.session, request(puts))).toMatchObject({ kind: 'ok' });
    expect(gh.maxInFlight()).toBe(3);
  });

  it('expands delete-dir from the base tree', async () => {
    const gh = fakeGitHub(publishScript());
    await publish(gh.session, request([{ kind: 'delete-dir', path: 'media-src/dmns/' }]));
    const tree = gh.calls.find((c) => c.key === 'POST /git/trees')?.body;
    expect(tree).toEqual({
      base_tree: T0,
      tree: [
        { path: 'media-src/dmns/cover.webp', mode: '100644', type: 'blob', sha: null },
        { path: 'media-src/dmns/shot-1.jpg', mode: '100644', type: 'blob', sha: null },
      ],
    });
  });

  it('returns unknown when the base tree listing is truncated', async () => {
    const gh = fakeGitHub(
      publishScript({
        [`GET /git/trees/${T0}?recursive=1`]: { body: { sha: T0, truncated: true, tree: [] } },
      }),
    );
    const result = await publish(
      gh.session,
      request([{ kind: 'delete-dir', path: 'media-src/dmns/' }]),
    );
    expect(result).toEqual({ kind: 'unknown', status: 0 });
    expect(gh.keys()).not.toContain('POST /git/trees');
  });
});

describe('publish unchanged (FR-367)', () => {
  it('makes no commit when the new tree equals the base tree', async () => {
    const gh = fakeGitHub(
      publishScript({ 'POST /git/trees': { status: 201, body: { sha: T0, tree: [] } } }),
    );
    const result = await publish(gh.session, request([THREE[0] as FileChange]));
    expect(result).toEqual({ kind: 'unchanged', headSha: H0 });
    expect(gh.keys()).not.toContain('POST /git/commits');
    expect(gh.keys()).not.toContain('PATCH /git/refs/heads/main');
  });

  it('is unchanged when every deletion targets a missing file', async () => {
    const gh = fakeGitHub(publishScript());
    const result = await publish(
      gh.session,
      request([{ kind: 'delete', path: 'src/content/data/projects/gone.json' }]),
    );
    expect(result).toEqual({ kind: 'unchanged', headSha: H0 });
    expect(gh.keys()).not.toContain('POST /git/trees');
  });
});

describe('publish rejects before any request (FR-363, FR-364)', () => {
  it.each<[string, PublishRequest]>([
    ['a workflow path', request([{ kind: 'put', path: '.github/workflows/ci.yml', content: 'x' }])],
    ['no changes', request([])],
    ['a bad sha', request(THREE, { expectedHeadSha: 'main' })],
    [
      'an 11 MB binary',
      request([{ kind: 'put-binary', path: IMAGE_PATH, bytes: new Uint8Array(11 * 1024 * 1024) }]),
    ],
  ])('%s makes zero calls', async (_name, req) => {
    const gh = fakeGitHub(publishScript());
    const result = await publish(gh.session, req);
    expect(['invalid', 'too-large']).toContain(result.kind);
    expect(gh.calls).toHaveLength(0);
  });

  it('caps tree entries after delete-dir expansion', async () => {
    const tree = Array.from({ length: 301 }, (_, i) => ({
      path: `media-src/big/f${i}.jpg`,
      type: 'blob',
    }));
    const gh = fakeGitHub(
      publishScript({
        [`GET /git/trees/${T0}?recursive=1`]: { body: { sha: T0, truncated: false, tree } },
      }),
    );
    const result = await publish(
      gh.session,
      request([{ kind: 'delete-dir', path: 'media-src/big/' }]),
    );
    expect(result).toEqual({ kind: 'invalid', reason: 'too-many-entries', path: null });
    expect(gh.keys()).not.toContain('POST /git/trees');
  });
});

describe('publish errors (FR-372)', () => {
  it('maps a rate limit on a blob upload and stops starting uploads', async () => {
    const limited = {
      status: 403,
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000600' },
      body: { message: 'API rate limit exceeded' },
    };
    const gh = fakeGitHub(publishScript({ 'POST /git/blobs': limited }));
    const puts: FileChange[] = Array.from({ length: 6 }, (_, i) => ({
      kind: 'put',
      path: `src/content/data/projects/p${i}.json`,
      content: `{"i":${i}}`,
    }));
    expect(await publish(gh.session, request(puts))).toEqual({
      kind: 'rate-limited',
      resetAt: 1_800_000_600_000,
    });
    expect(gh.keys().filter((k) => k === 'POST /git/blobs')).toHaveLength(3);
    expect(gh.keys()).not.toContain('PATCH /git/refs/heads/main');
  });

  it('maps 401 on the head read to unauthorized', async () => {
    const gh = fakeGitHub(publishScript({ 'GET /git/ref/heads/main': { status: 401, body: {} } }));
    expect(await publish(gh.session, request(THREE))).toEqual({ kind: 'unauthorized' });
    expect(gh.calls).toHaveLength(1);
  });

  it('maps a protected-branch 422 on the ref update to forbidden', async () => {
    const gh = fakeGitHub(
      publishScript({
        'PATCH /git/refs/heads/main': {
          status: 422,
          body: { message: 'Protected branch update failed for refs/heads/main.' },
        },
      }),
    );
    expect(await publish(gh.session, request(THREE))).toEqual({
      kind: 'forbidden',
      reason: 'branch-protected',
    });
  });

  it('maps a dropped connection to network', async () => {
    const gh = fakeGitHub(
      publishScript({ 'POST /git/commits': 'reject', 'POST /git/blobs': blobStep }),
    );
    expect(await publish(gh.session, request(THREE))).toEqual({ kind: 'network' });
    expect(gh.keys()).not.toContain('PATCH /git/refs/heads/main');
  });
});
