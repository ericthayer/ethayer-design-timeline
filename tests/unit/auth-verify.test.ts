import { describe, expect, it } from 'vitest';
import { AUTH_MESSAGES, authMessage } from '../../src/core/auth/messages.ts';
import {
  apiInit,
  parseExpiry,
  precheck,
  verifyToken,
  WRITE_PROBE,
  type AuthErrorKind,
  type FetchLike,
  type VerifyResult,
} from '../../src/core/auth/verify.ts';

const TOKEN = 'github_pat_TEST';
const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
const REPO_OK = {
  full_name: 'ericthayer/ethayer-design-timeline',
  permissions: { push: true, pull: true },
};

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | 'throw';

const reply = (r: Exclude<Reply, 'throw'>): Response =>
  new Response(r.body === undefined ? null : JSON.stringify(r.body), {
    status: r.status,
    headers: r.headers ?? {},
  });

function github(
  user: Reply,
  repo: Reply,
  blob: Reply = { status: 201, body: { sha: 'probe' } },
): { fetch: FetchLike; calls: [string, RequestInit][] } {
  const calls: [string, RequestInit][] = [];
  const fetch: FetchLike = (input, init) => {
    calls.push([input, init]);
    const r = input.endsWith('/user') ? user : input.endsWith('/git/blobs') ? blob : repo;
    return r === 'throw'
      ? Promise.reject(new TypeError('Failed to fetch'))
      : Promise.resolve(reply(r));
  };
  return { fetch, calls };
}

const run = (
  user: Reply,
  repo: Reply,
  storedExpiresAt: Date | null = null,
): Promise<VerifyResult> =>
  verifyToken(TOKEN, { fetch: github(user, repo).fetch, now: () => NOW, storedExpiresAt });

const kindOf = (result: VerifyResult): AuthErrorKind | 'ok' => (result.ok ? 'ok' : result.kind);
const USER_OK: Reply = { status: 200, body: { login: 'ericthayer' } };
const REPO_200: Reply = { status: 200, body: REPO_OK };

describe('precheck (FR-346)', () => {
  it('trims, then refuses empty and non-fine-grained tokens', () => {
    expect(precheck('   ')).toMatchObject({ ok: false, kind: 'empty' });
    expect(precheck('ghp_classic')).toMatchObject({ ok: false, kind: 'not-fine-grained' });
    expect(precheck(`  ${TOKEN}\n`)).toEqual({ ok: true, token: TOKEN });
  });
});

describe('verifyToken (FR-347)', () => {
  it('sends both GETs and the write check to api.github.com with the token, version, and no credentials', async () => {
    const { fetch, calls } = github(USER_OK, REPO_200);
    await verifyToken(TOKEN, { fetch });
    expect(calls.map(([url]) => url).sort()).toEqual([
      'https://api.github.com/repos/ericthayer/ethayer-design-timeline',
      'https://api.github.com/repos/ericthayer/ethayer-design-timeline/git/blobs',
      'https://api.github.com/user',
    ]);
    for (const [, init] of calls) {
      const headers = new Headers(init.headers);
      expect(headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
      expect(headers.get('X-GitHub-Api-Version')).toBe('2022-11-28');
      expect(headers.get('Accept')).toBe('application/vnd.github+json');
      expect(init).toMatchObject({
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
      });
    }
  });

  it('ok: returns the login, and the expiry when the header is readable', async () => {
    const withHeader = await run(
      {
        ...USER_OK,
        headers: { 'github-authentication-token-expiration': '2026-11-23 16:48:52 UTC' },
      },
      REPO_200,
    );
    expect(withHeader).toEqual({
      ok: true,
      login: 'ericthayer',
      expiresAt: new Date('2026-11-23T16:48:52Z'),
    });
    expect(await run(USER_OK, REPO_200)).toEqual({
      ok: true,
      login: 'ericthayer',
      expiresAt: null,
    });
  });

  it('accepts the login case-insensitively (D6)', async () => {
    expect(kindOf(await run({ status: 200, body: { login: 'EricThayer' } }, REPO_200))).toBe('ok');
  });

  it.each<[string, Reply, Reply, AuthErrorKind]>([
    ['network error', 'throw', REPO_200, 'network'],
    ['/user 429', { status: 429 }, REPO_200, 'rate-limited'],
    [
      '/repos 403 with no requests left',
      USER_OK,
      { status: 403, headers: { 'x-ratelimit-remaining': '0' } },
      'rate-limited',
    ],
    ['/user 401', { status: 401 }, { status: 401 }, 'bad-token'],
    ['another account', { status: 200, body: { login: 'someone' } }, REPO_200, 'wrong-account'],
    ['/repos 404', USER_OK, { status: 404 }, 'wrong-repo'],
    [
      '/repos 403',
      USER_OK,
      { status: 403, headers: { 'x-ratelimit-remaining': '12' } },
      'wrong-repo',
    ],
    [
      'full_name mismatch',
      USER_OK,
      { status: 200, body: { ...REPO_OK, full_name: 'ericthayer/other' } },
      'wrong-repo',
    ],
    [
      'push false',
      USER_OK,
      { status: 200, body: { ...REPO_OK, permissions: { push: false } } },
      'read-only',
    ],
    [
      'no permissions object',
      USER_OK,
      { status: 200, body: { full_name: REPO_OK.full_name } },
      'read-only',
    ],
    ['/user 500', { status: 500 }, REPO_200, 'github-error'],
    ['/repos 502', USER_OK, { status: 502 }, 'github-error'],
  ])('%s → %s', async (_name, user, repo, kind) => {
    expect(kindOf(await run(user, repo))).toBe(kind);
  });

  it('precedence: network beats everything, rate limits beat a 401', async () => {
    expect(kindOf(await run({ status: 401 }, 'throw'))).toBe('network');
    expect(kindOf(await run({ status: 401 }, { status: 429 }))).toBe('rate-limited');
    expect(kindOf(await run({ status: 200, body: { login: 'someone' } }, { status: 404 }))).toBe(
      'wrong-account',
    );
    expect(kindOf(await run(USER_OK, { status: 404 }))).toBe('wrong-repo');
  });

  it('rate-limited carries the reset time from retry-after or x-ratelimit-reset', async () => {
    const retry = await run({ status: 429, headers: { 'retry-after': '120' } }, REPO_200);
    expect(retry).toEqual({ ok: false, kind: 'rate-limited', retryAt: new Date(NOW + 120_000) });
    const reset = await run(
      { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1792864132' } },
      REPO_200,
    );
    expect(reset).toEqual({ ok: false, kind: 'rate-limited', retryAt: new Date(1792864132_000) });
  });

  it('a 401 is expired only when a stored expiry has passed', async () => {
    expect(kindOf(await run({ status: 401 }, { status: 401 }, new Date(NOW - 1)))).toBe('expired');
    expect(kindOf(await run({ status: 401 }, { status: 401 }, new Date(NOW + 60_000)))).toBe(
      'bad-token',
    );
  });
});

describe('apiInit and parseExpiry', () => {
  it('replaces a caller Authorization and keeps a caller Accept', () => {
    const init = apiInit(TOKEN, {
      headers: { Authorization: 'Bearer other', Accept: 'application/vnd.github.raw+json' },
      credentials: 'include',
    });
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(headers.get('Accept')).toBe('application/vnd.github.raw+json');
    expect(init.credentials).toBe('omit');
  });

  it('parses UTC and offset expiry formats, and rejects anything else', () => {
    expect(parseExpiry('2026-11-23 16:48:52 UTC')).toEqual(new Date('2026-11-23T16:48:52Z'));
    expect(parseExpiry('2026-11-23 10:48:52 -0600')).toEqual(new Date('2026-11-23T16:48:52Z'));
    expect(parseExpiry(null)).toBeNull();
    expect(parseExpiry('next tuesday')).toBeNull();
  });
});

describe('messages (FR-348)', () => {
  it('has a message for every kind, and none echo a token', () => {
    const kinds: AuthErrorKind[] = [
      'empty',
      'not-fine-grained',
      'bad-token',
      'expired',
      'wrong-account',
      'wrong-repo',
      'read-only',
      'rate-limited',
      'network',
      'github-error',
    ];
    expect(Object.keys(AUTH_MESSAGES).sort()).toEqual([...kinds].sort());
    for (const kind of kinds) expect(AUTH_MESSAGES[kind].length).toBeGreaterThan(20);
    expect(AUTH_MESSAGES['read-only']).toBe(
      'This token can read the repository but not change it. Set Contents to Read and write.',
    );
    expect(AUTH_MESSAGES['bad-token']).toContain('mistyped, revoked, or expired');
    expect(AUTH_MESSAGES['wrong-account']).toContain('ericthayer');
  });

  it('names the wait for a rate limit', () => {
    expect(authMessage('rate-limited', new Date(NOW + 61_000), NOW)).toContain('2 minutes');
    expect(authMessage('rate-limited', null, NOW)).toBe(AUTH_MESSAGES['rate-limited']);
  });
});

describe('write check (FR-347 amended, V2)', () => {
  const probe = (blob: Reply): Promise<VerifyResult> =>
    verifyToken(TOKEN, { fetch: github(USER_OK, REPO_200, blob).fetch, now: () => NOW });

  it('refuses a read-only token even when the account can push', async () => {
    expect(kindOf(await probe({ status: 403, body: { message: 'Resource not accessible' } }))).toBe(
      'read-only',
    );
    expect(kindOf(await probe({ status: 404 }))).toBe('read-only');
  });

  it('maps a thrown request, a rate limit, and a 5xx', async () => {
    expect(kindOf(await probe('throw'))).toBe('network');
    expect(kindOf(await probe({ status: 403, headers: { 'x-ratelimit-remaining': '0' } }))).toBe(
      'rate-limited',
    );
    expect(kindOf(await probe({ status: 500 }))).toBe('github-error');
  });

  it('POSTs the fixed probe blob only after the read checks pass', async () => {
    const ok = github(USER_OK, REPO_200);
    expect(kindOf(await verifyToken(TOKEN, { fetch: ok.fetch, now: () => NOW }))).toBe('ok');
    const [url, init] = ok.calls.at(-1) ?? ['', {}];
    expect(url).toBe('https://api.github.com/repos/ericthayer/ethayer-design-timeline/git/blobs');
    expect(init.method).toBe('POST');
    expect(JSON.parse(typeof init.body === 'string' ? init.body : '')).toEqual({
      content: WRITE_PROBE,
      encoding: 'utf-8',
    });

    const refused = github({ status: 401 }, { status: 401 });
    await verifyToken(TOKEN, { fetch: refused.fetch, now: () => NOW });
    expect(refused.calls.some(([u]) => u.endsWith('/git/blobs'))).toBe(false);
  });
});
