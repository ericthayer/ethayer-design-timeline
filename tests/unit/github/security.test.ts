import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import {
  publish,
  readFile,
  readHead,
  watchDeploy,
  type FileChange,
  type PublishRequest,
} from '../../../src/core/github/index.ts';
import {
  C2,
  fakeGitHub,
  H0,
  H1,
  publishScript,
  TOKEN,
  type Reply,
  type Script,
} from './fake-github.ts';

const SECRET = 'SECRET-CONTENT-7f3a';
const SECRET_BYTES = new TextEncoder().encode(`${SECRET}-bytes`);
const CHANGES: FileChange[] = [
  { kind: 'put', path: 'src/content/data/projects/dmns.json', content: `{"x":"${SECRET}"}` },
  { kind: 'put-binary', path: 'media-src/dmns/cover.webp', bytes: SECRET_BYTES },
];
const request = (changes: readonly FileChange[] = CHANGES): PublishRequest => ({
  changes,
  message: 'content: update dmns via admin',
  expectedHeadSha: H0,
});

const HOSTILE = [
  '../package.json',
  'src/content/data/../../../netlify.toml',
  '.github/workflows/ci.yml',
  'src/content/data/.env',
  '/etc/passwd',
  'src\\content\\data\\x.json',
  'src/content/data/%2e%2e/x.json',
  'src/content/data//x.json',
  'src/main.ts',
  'netlify.toml',
  'media-src/dmns/cover.gif',
  'media-src/dmns/../../index.html',
  'public/_headers',
  '',
];

let spies: MockInstance[] = [];
beforeAll(() => {
  spies = (['log', 'info', 'warn', 'error', 'debug', 'trace'] as const).map((m) =>
    vi.spyOn(console, m),
  );
});
afterAll(() => {
  // FR-376: nothing in the module logs, across every scenario in this file.
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
afterEach(() => {
  sessionStorage.clear();
});

describe('allowlist at the public API (FR-363)', () => {
  it.each(HOSTILE)('publish refuses %j with zero requests', async (path) => {
    const gh = fakeGitHub(publishScript());
    for (const change of [
      { kind: 'put', path, content: '{}' },
      { kind: 'put-binary', path, bytes: new Uint8Array(1) },
      { kind: 'delete', path },
      { kind: 'delete-dir', path },
    ] satisfies FileChange[]) {
      expect(await publish(gh.session, request([change]))).toMatchObject({ kind: 'invalid' });
      // A hostile path anywhere in a batch sinks the whole batch.
      expect(await publish(gh.session, request([...CHANGES, change]))).toMatchObject({
        kind: 'invalid',
      });
    }
    expect(gh.calls).toHaveLength(0);
  });

  it.each(HOSTILE)('readFile refuses %j with zero requests', async (path) => {
    const gh = fakeGitHub({});
    expect(await readFile(gh.session, path, H0)).toMatchObject({ kind: 'invalid' });
    expect(gh.calls).toHaveLength(0);
  });

  it('never sends force: true or an author', async () => {
    const gh = fakeGitHub(publishScript());
    await publish(gh.session, request());
    const bodies = JSON.stringify(gh.calls.map((c) => c.body));
    expect(bodies).not.toContain('"force":true');
    expect(bodies).not.toContain('"author"');
  });
});

describe('results carry no content, bytes, headers, or token (FR-376)', () => {
  const echo: Reply = {
    status: 422,
    headers: { 'x-ratelimit-remaining': '9', 'x-secret-header': 'HEADER-VALUE' },
    body: { message: 'Invalid request', echoed: SECRET, errors: [SECRET] },
  };
  const limited: Reply = {
    status: 403,
    headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000600' },
    body: { message: 'API rate limit exceeded', echoed: SECRET },
  };
  const scenarios: [string, Script][] = [
    ['422 on a blob', publishScript({ 'POST /git/blobs': echo })],
    ['422 on the tree', publishScript({ 'POST /git/trees': echo })],
    ['rate limit on the commit', publishScript({ 'POST /git/commits': limited })],
    ['401 on the ref', publishScript({ 'PATCH /git/refs/heads/main': { status: 401 } })],
    [
      '500 on the ref',
      publishScript({ 'PATCH /git/refs/heads/main': { status: 500, body: echo.body } }),
    ],
    ['network on a blob', publishScript({ 'POST /git/blobs': 'reject' })],
    [
      'conflict',
      publishScript({
        'GET /git/ref/heads/main': { body: { object: { sha: H1 } } },
        [`GET /compare/${H0}...${H1}`]: {
          body: { status: 'ahead', files: [{ filename: 'src/content/data/projects/dmns.json' }] },
        },
      }),
    ],
  ];

  it.each(scenarios)('%s', async (_name, script) => {
    const gh = fakeGitHub(script);
    const result = await publish(gh.session, request());
    expect(result.kind).not.toBe('ok');
    const text = JSON.stringify(result);
    for (const leak of [SECRET, TOKEN, 'HEADER-VALUE', 'Bearer', 'x-ratelimit', 'base64']) {
      expect(text).not.toContain(leak);
    }
  });

  it('reads and deploy states carry no token either', async () => {
    const gh = fakeGitHub({
      'GET /git/ref/heads/main': echo,
      [`GET /commits/${C2}/status`]: { status: 404, body: { message: 'Not Found' } },
    });
    const states: unknown[] = [];
    for await (const state of watchDeploy(gh.session, C2)) states.push(state);
    const text = JSON.stringify([await readHead(gh.session), states]);
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain('HEADER-VALUE');
  });
});
