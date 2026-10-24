import { ESLint } from 'eslint';
import { afterEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../../src/core/auth/config.ts';
import { patProvider } from '../../src/core/auth/provider.ts';
import {
  createSession,
  getCurrentSession,
  resolveApiUrl,
  SignedOutError,
  announceSignedIn,
} from '../../src/core/auth/session.ts';
import { createTokenStore, type TokenStore } from '../../src/core/auth/token-store.ts';
import type { FetchLike } from '../../src/core/auth/verify.ts';

const TOKEN = 'github_pat_SECRET';

function recorder(status = 200): { fetch: FetchLike; calls: [string, RequestInit][] } {
  const calls: [string, RequestInit][] = [];
  const fetch: FetchLike = (input, init) => {
    calls.push([input, init]);
    return Promise.resolve(new Response('{}', { status }));
  };
  return { fetch, calls };
}

function signedOutEvents(): { reasons: string[]; stop: () => void } {
  const reasons: string[] = [];
  const listener = (event: CustomEvent<{ readonly reason: string }>): void => {
    reasons.push(event.detail.reason);
  };
  document.addEventListener('admin:signed-out', listener);
  return {
    reasons,
    stop: () => {
      document.removeEventListener('admin:signed-out', listener);
    },
  };
}

const memoryStore = (): TokenStore => createTokenStore(() => sessionStorage);

afterEach(() => {
  sessionStorage.clear();
});

describe('authorizedFetch (FR-351)', () => {
  it.each([
    'https://evil.example/x',
    '//evil.example/x',
    '/\\evil.example/x',
    'https://api.github.com@evil.example/x',
    'user',
  ])('rejects %s with a TypeError and sends nothing', async (path) => {
    const { fetch, calls } = recorder();
    const { session } = createSession({
      token: TOKEN,
      login: 'ericthayer',
      expiresAt: null,
      store: memoryStore(),
      fetch,
    });
    await expect(session.authorizedFetch(path as `/${string}`)).rejects.toBeInstanceOf(TypeError);
    expect(calls).toHaveLength(0);
  });

  it('allows @ inside a rooted path, which stays on api.github.com', () => {
    expect(resolveApiUrl('/repos/o/r/contents/media-src/x/photo@2x.png').origin).toBe(
      'https://api.github.com',
    );
  });

  it('sets the token and GitHub headers, and a caller cannot override Authorization', async () => {
    const { fetch, calls } = recorder();
    const { session } = createSession({
      token: TOKEN,
      login: 'ericthayer',
      expiresAt: null,
      store: memoryStore(),
      fetch,
    });
    const response = await session.authorizedFetch('/repos/o/r', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer stolen', 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'reload',
    });
    expect(response.status).toBe(200);
    const [url, init] = calls[0] ?? ['', {}];
    const headers = new Headers(init.headers);
    expect(url).toBe('https://api.github.com/repos/o/r');
    expect(headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(headers.get('Accept')).toBe('application/vnd.github+json');
    expect(headers.get('X-GitHub-Api-Version')).toBe('2022-11-28');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init).toMatchObject({
      method: 'PATCH',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'reload',
    });
  });

  it('exposes no token on the session object', () => {
    const { session } = createSession({
      token: TOKEN,
      login: 'ericthayer',
      expiresAt: null,
      store: memoryStore(),
    });
    expect(JSON.stringify(session)).not.toContain(TOKEN);
    expect(Object.values(session).map(String).join(' ')).not.toContain(TOKEN);
    expect(session.repo).toEqual({
      owner: 'ericthayer',
      name: 'ethayer-design-timeline',
      branch: 'main',
    });
  });
});

describe('401 ends the session (FR-352)', () => {
  it('clears the store, fires signed-out once, and rejects later calls', async () => {
    const store = memoryStore();
    store.write({ v: 1, token: TOKEN, login: 'ericthayer', expiresAt: null });
    const { fetch, calls } = recorder(401);
    const { session } = createSession({
      token: TOKEN,
      login: 'ericthayer',
      expiresAt: null,
      store,
      fetch,
    });
    announceSignedIn(session);
    const events = signedOutEvents();

    const response = await session.authorizedFetch('/user');
    expect(response.status).toBe(401);
    expect(store.read()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(events.reasons).toEqual(['unauthorized']);
    expect(getCurrentSession()).toBeNull();

    await expect(session.authorizedFetch('/user')).rejects.toBeInstanceOf(SignedOutError);
    expect(calls).toHaveLength(1);
    expect(events.reasons).toEqual(['unauthorized']);
    events.stop();
  });
});

describe('token store (FR-349)', () => {
  it('round-trips through sessionStorage', () => {
    const store = createTokenStore();
    store.write({ v: 1, token: TOKEN, login: 'ericthayer', expiresAt: null });
    expect(createTokenStore().read()).toEqual({
      v: 1,
      token: TOKEN,
      login: 'ericthayer',
      expiresAt: null,
    });
    expect(store.persistent).toBe(true);
    expect(localStorage.length).toBe(0);
  });

  it('falls back to memory when storage throws', () => {
    const store = createTokenStore(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(store.read()).toBeNull();
    store.write({ v: 1, token: TOKEN, login: 'ericthayer', expiresAt: null });
    expect(store.persistent).toBe(false);
    expect(store.read()?.token).toBe(TOKEN);
    store.clear();
    expect(store.read()).toBeNull();
  });

  it('falls back to memory when setItem throws (quota)', () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
      removeItem: () => undefined,
    } as unknown as Storage;
    const store = createTokenStore(() => broken);
    store.write({ v: 1, token: TOKEN, login: 'ericthayer', expiresAt: null });
    expect(store.persistent).toBe(false);
    expect(store.read()?.login).toBe('ericthayer');
  });

  it('drops a corrupt stored value', () => {
    sessionStorage.setItem(STORAGE_KEY, '{"v":2}');
    expect(createTokenStore().read()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

const githubOk =
  (login = 'ericthayer'): FetchLike =>
  (input) =>
    Promise.resolve(
      input.endsWith('/user')
        ? Response.json({ login })
        : Response.json({
            full_name: 'ericthayer/ethayer-design-timeline',
            permissions: { push: true },
          }),
    );

describe('patProvider (FR-350, FR-353, FR-359, D6)', () => {
  it('signs in, stores the session, and restores it after a reload', async () => {
    const provider = patProvider({ fetch: githubOk() });
    const outcome = await provider.signIn(`  ${TOKEN} `);
    expect(outcome.ok && outcome.session.login).toBe('ericthayer');
    expect(createTokenStore().read()?.token).toBe(TOKEN);

    const restored = await patProvider({ fetch: githubOk() }).restore();
    expect(restored?.ok).toBe(true);
  });

  it('refuses another account and stores nothing', async () => {
    const outcome = await patProvider({ fetch: githubOk('someone-else') }).signIn(TOKEN);
    expect(outcome).toMatchObject({ ok: false, kind: 'wrong-account' });
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('refuses a classic token without contacting GitHub', async () => {
    const { fetch, calls } = recorder();
    expect(await patProvider({ fetch }).signIn('ghp_classic')).toMatchObject({
      kind: 'not-fine-grained',
    });
    expect(calls).toHaveLength(0);
  });

  it('clears a stored token that no longer verifies', async () => {
    createTokenStore().write({ v: 1, token: TOKEN, login: 'ericthayer', expiresAt: null });
    const restored = await patProvider({ fetch: recorder(401).fetch }).restore();
    expect(restored).toMatchObject({ ok: false, kind: 'bad-token' });
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns null when nothing is stored', async () => {
    expect(await patProvider({ fetch: githubOk() }).restore()).toBeNull();
  });

  it('signs out: clears storage and fires reason user', async () => {
    const provider = patProvider({ fetch: githubOk() });
    const outcome = await provider.signIn(TOKEN);
    const events = signedOutEvents();
    provider.signOut();
    expect(events.reasons).toEqual(['user']);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    if (outcome.ok)
      await expect(outcome.session.authorizedFetch('/user')).rejects.toBeInstanceOf(SignedOutError);
    events.stop();
  });
});

describe('token hygiene lint (FR-356)', () => {
  it('makes console an error on every admin path', async () => {
    const eslint = new ESLint();
    for (const file of ['src/core/auth/session.ts', 'src/admin/entry.ts']) {
      const config = (await eslint.calculateConfigForFile(file)) as {
        rules: Record<string, unknown>;
      };
      expect((config.rules['no-console'] as unknown[])[0], file).toBe(2);
    }
  }, 20_000);
});
