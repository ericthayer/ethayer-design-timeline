import { ALLOWED_LOGIN, API_ORIGIN, API_VERSION, REPO, TOKEN_PREFIX } from './config.ts';

/** Why a token was refused (spec 004 admin-auth §5, FR-346–FR-348). Carries no token text. */
export type AuthErrorKind =
  | 'empty'
  | 'not-fine-grained'
  | 'bad-token'
  | 'expired'
  | 'wrong-account'
  | 'wrong-repo'
  | 'read-only'
  | 'rate-limited'
  | 'network'
  | 'github-error';

export interface AuthFailure {
  readonly ok: false;
  readonly kind: AuthErrorKind;
  /** When GitHub's rate limit resets, for `rate-limited` only. */
  readonly retryAt: Date | null;
}

export type VerifyResult =
  { readonly ok: true; readonly login: string; readonly expiresAt: Date | null } | AuthFailure;

export type Precheck = { readonly ok: true; readonly token: string } | AuthFailure;

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface VerifyDeps {
  readonly fetch?: FetchLike;
  /** The expiry saved with a restored session, to tell `expired` from `bad-token`. */
  readonly storedExpiresAt?: Date | null;
  readonly now?: () => number;
}

export const failure = (kind: AuthErrorKind, retryAt: Date | null = null): AuthFailure => ({
  ok: false,
  kind,
  retryAt,
});

/** FR-346: trim, then refuse empty input and anything that isn't a fine-grained token. */
export function precheck(raw: string): Precheck {
  const token = raw.trim();
  if (token === '') return failure('empty');
  if (!token.startsWith(TOKEN_PREFIX)) return failure('not-fine-grained');
  return { ok: true, token };
}

/** Request options for every GitHub call (FR-351). The caller's Authorization never survives. */
export function apiInit(token: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/vnd.github+json');
  headers.set('X-GitHub-Api-Version', API_VERSION);
  return {
    cache: 'no-store',
    ...init,
    headers,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  };
}

const EXPIRY = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) (UTC|[+-]\d{2}:?\d{2})$/;

/** `github-authentication-token-expiration`, e.g. "2026-11-23 16:48:52 UTC" (V3). */
export function parseExpiry(value: string | null): Date | null {
  const match = value === null ? null : EXPIRY.exec(value.trim());
  const [, day, time, zone] = match ?? [];
  if (!day || !time || !zone) return null;
  const offset = zone === 'UTC' ? 'Z' : `${zone.slice(0, 3)}:${zone.slice(-2)}`;
  const date = new Date(`${day}T${time}${offset}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 429, or 403 with no requests left, is a rate limit. Returns the reset time or undefined. */
function rateLimit(response: Response, now: number): { retryAt: Date | null } | undefined {
  const exhausted =
    response.status === 429 ||
    (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');
  if (!exhausted) return undefined;
  const retryAfter = Number(response.headers.get('retry-after') ?? NaN);
  if (Number.isFinite(retryAfter)) return { retryAt: new Date(now + retryAfter * 1000) };
  const reset = Number(response.headers.get('x-ratelimit-reset') ?? NaN);
  return { retryAt: Number.isFinite(reset) ? new Date(reset * 1000) : null };
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * FR-347: `GET /user` and `GET /repos/{owner}/{repo}` in parallel, mapped with this precedence:
 * network → rate-limited → /user 401 → wrong-account → wrong-repo → read-only → github-error.
 */
export async function verifyToken(token: string, deps: VerifyDeps = {}): Promise<VerifyResult> {
  const send: FetchLike = deps.fetch ?? ((input, init) => fetch(input, init));
  const now = deps.now ?? Date.now;
  const get = (path: string): Promise<Response> => send(API_ORIGIN + path, apiInit(token));

  let user: Response;
  let repo: Response;
  try {
    [user, repo] = await Promise.all([get('/user'), get(`/repos/${REPO.owner}/${REPO.name}`)]);
  } catch {
    return failure('network');
  }

  const limited = rateLimit(user, now()) ?? rateLimit(repo, now());
  if (limited) return failure('rate-limited', limited.retryAt);

  if (user.status === 401) {
    const stored = deps.storedExpiresAt ?? null;
    return failure(stored !== null && stored.getTime() <= now() ? 'expired' : 'bad-token');
  }

  const userBody = user.ok ? await readJson(user) : null;
  const login = typeof userBody?.['login'] === 'string' ? userBody['login'] : null;
  if (login !== null && login.toLowerCase() !== ALLOWED_LOGIN) return failure('wrong-account');

  if (repo.status === 404 || repo.status === 403) return failure('wrong-repo');
  if (repo.ok) {
    const repoBody = await readJson(repo);
    const fullName = repoBody?.['full_name'];
    const expected = `${REPO.owner}/${REPO.name}`.toLowerCase();
    if (typeof fullName !== 'string' || fullName.toLowerCase() !== expected) {
      return failure('wrong-repo');
    }
    const permissions = repoBody?.['permissions'];
    const push =
      typeof permissions === 'object' && permissions !== null && 'push' in permissions
        ? permissions.push
        : undefined;
    if (push !== true) return failure('read-only');
  }

  if (!user.ok || !repo.ok || login === null) return failure('github-error');
  return {
    ok: true,
    login,
    expiresAt: parseExpiry(user.headers.get('github-authentication-token-expiration')),
  };
}
