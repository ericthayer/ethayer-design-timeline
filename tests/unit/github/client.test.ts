import { afterEach, describe, expect, it } from 'vitest';
import { readFile, readHead, request } from '../../../src/core/github/client.ts';
import { isRef } from '../../../src/core/github/types.ts';
import { fakeGitHub, TOKEN } from './fake-github.ts';
import contents from './fixtures/contents.json';
import ref from './fixtures/ref.json';

const H1 = '1'.repeat(40);
const FILE = 'src/content/data/projects/dmns.json';
const CONTENTS_KEY = `GET /contents/src/content/data/projects/dmns.json?ref=${H1}`;

afterEach(() => {
  sessionStorage.clear();
});

describe('readHead (FR-374)', () => {
  it('returns the main sha through authorizedFetch', async () => {
    const gh = fakeGitHub({ 'GET /git/ref/heads/main': { body: ref } });
    expect(await readHead(gh.session)).toEqual({ kind: 'ok', sha: H1 });
    expect(gh.keys()).toEqual(['GET /git/ref/heads/main']);
    expect(gh.calls[0]?.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('maps a shape mismatch to unknown (status 0)', async () => {
    const gh = fakeGitHub({ 'GET /git/ref/heads/main': { body: { object: {} } } });
    expect(await readHead(gh.session)).toEqual({ kind: 'unknown', status: 0 });
  });

  it('maps a rejected fetch to network', async () => {
    const gh = fakeGitHub({ 'GET /git/ref/heads/main': 'reject' });
    expect(await readHead(gh.session)).toEqual({ kind: 'network' });
  });

  it('maps 401 to unauthorized, and an ended session stays unauthorized', async () => {
    const gh = fakeGitHub({ 'GET /git/ref/heads/main': { status: 401, body: {} } });
    expect(await readHead(gh.session)).toEqual({ kind: 'unauthorized' });
    expect(await readHead(gh.session)).toEqual({ kind: 'unauthorized' });
    expect(gh.calls).toHaveLength(1);
  });
});

describe('readFile (FR-374)', () => {
  it('decodes base64 UTF-8, including "é"', async () => {
    const gh = fakeGitHub({ [CONTENTS_KEY]: { body: contents } });
    expect(await readFile(gh.session, FILE, H1)).toEqual({
      kind: 'ok',
      text: '{\n  "title": "Café"\n}\n',
      blobSha: contents.sha,
    });
  });

  it('maps 404 to not-found (a new project)', async () => {
    const gh = fakeGitHub({ [CONTENTS_KEY]: { status: 404, body: { message: 'Not Found' } } });
    expect(await readFile(gh.session, FILE, H1)).toEqual({ kind: 'not-found' });
  });

  it('reports a file over 1 MB as too-large', async () => {
    const big = { ...contents, encoding: 'none', content: '' };
    const gh = fakeGitHub({ [CONTENTS_KEY]: { body: big } });
    expect(await readFile(gh.session, FILE, H1)).toEqual({
      kind: 'too-large',
      path: FILE,
      limitBytes: 1024 * 1024,
    });
  });

  it.each([
    ['a directory listing', [contents]],
    ['a symlink', { ...contents, type: 'symlink' }],
    ['bad base64', { ...contents, content: '@@@' }],
    ['invalid UTF-8', { ...contents, content: '/w==' }],
  ])('maps %s to unknown', async (_name, body) => {
    const gh = fakeGitHub({ [CONTENTS_KEY]: { body } });
    expect(await readFile(gh.session, FILE, H1)).toEqual({ kind: 'unknown', status: 0 });
  });

  it('URI-encodes the ref', async () => {
    const gh = fakeGitHub({});
    await readFile(gh.session, FILE, 'a&b');
    expect(gh.calls[0]?.path).toBe('/contents/src/content/data/projects/dmns.json?ref=a%26b');
  });

  it('refuses a path outside the allowlist without a request', async () => {
    const gh = fakeGitHub({});
    expect(await readFile(gh.session, '.github/workflows/ci.yml', H1)).toMatchObject({
      kind: 'invalid',
    });
    expect(await readFile(gh.session, 'package.json', H1)).toMatchObject({ kind: 'invalid' });
    expect(gh.calls).toHaveLength(0);
  });
});

describe('request', () => {
  it('sends a JSON body', async () => {
    const gh = fakeGitHub({ 'POST /git/refs': { status: 201, body: ref } });
    const result = await request(
      gh.session,
      'POST',
      '/repos/ericthayer/ethayer-design-timeline/git/refs',
      isRef,
      {
        a: 1,
      },
    );
    expect(result.kind).toBe('ok');
    expect(gh.calls[0]?.body).toEqual({ a: 1 });
    expect(gh.calls[0]?.headers.get('Content-Type')).toBe('application/json');
  });

  it('maps a non-JSON error body by status', async () => {
    const gh = fakeGitHub({ 'GET /git/ref/heads/main': { status: 502 } });
    expect(await readHead(gh.session)).toEqual({ kind: 'unknown', status: 502 });
  });
});
