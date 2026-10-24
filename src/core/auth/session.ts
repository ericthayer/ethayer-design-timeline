import { API_ORIGIN, REPO } from './config.ts';
import type { TokenStore } from './token-store.ts';
import { apiInit, type FetchLike } from './verify.ts';

/** The consumer contract (spec 004 admin-auth §5). The token never leaves this module. */
export interface AdminSession {
  readonly login: string;
  readonly repo: { readonly owner: string; readonly name: string; readonly branch: 'main' };
  /** null when GitHub doesn't expose the expiry header. */
  readonly expiresAt: Date | null;
  /** `path` is relative to https://api.github.com, e.g. `/repos/o/r/git/refs/heads/main`. */
  authorizedFetch(path: `/${string}`, init?: RequestInit): Promise<Response>;
}

export type SignOutReason = 'user' | 'unauthorized';

declare global {
  interface DocumentEventMap {
    'admin:signed-in': CustomEvent<AdminSession>;
    'admin:signed-out': CustomEvent<{ readonly reason: SignOutReason }>;
  }
}

/** Every call on a session that has ended (FR-352). */
export class SignedOutError extends Error {
  override readonly name = 'SignedOutError';
  constructor() {
    super('The admin session has ended. Sign in again.');
  }
}

/** FR-351: only `/`-rooted paths that stay on https://api.github.com. */
export function resolveApiUrl(path: string): URL {
  const rooted = path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
  const url = rooted ? new URL(path, API_ORIGIN) : null;
  if (!url || url.origin !== API_ORIGIN || url.username !== '' || url.password !== '') {
    throw new TypeError('authorizedFetch takes a path relative to https://api.github.com');
  }
  return url;
}

export interface SessionHandle {
  readonly session: AdminSession;
  /** Ends the session once: clears storage and memory, then fires `admin:signed-out`. */
  end(reason: SignOutReason): void;
}

export interface SessionOptions {
  readonly token: string;
  readonly login: string;
  readonly expiresAt: Date | null;
  readonly store: TokenStore;
  readonly fetch?: FetchLike;
}

let current: AdminSession | null = null;

/** The live session, for consumers that load after `admin:signed-in` fired. */
export const getCurrentSession = (): AdminSession | null => current;

export function announceSignedIn(session: AdminSession): void {
  current = session;
  document.dispatchEvent(new CustomEvent('admin:signed-in', { detail: session }));
}

export function createSession(options: SessionOptions): SessionHandle {
  const send: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  let token: string | null = options.token;

  const end = (reason: SignOutReason): void => {
    if (token === null) return;
    token = null;
    options.store.clear();
    if (current === session) current = null;
    document.dispatchEvent(new CustomEvent('admin:signed-out', { detail: { reason } }));
  };

  const session: AdminSession = Object.freeze({
    login: options.login,
    repo: Object.freeze({ owner: REPO.owner, name: REPO.name, branch: REPO.branch }),
    expiresAt: options.expiresAt,
    async authorizedFetch(path: `/${string}`, init: RequestInit = {}): Promise<Response> {
      if (token === null) throw new SignedOutError();
      const url = resolveApiUrl(path);
      const response = await send(url.href, apiInit(token, init));
      // FR-352: end the session before the caller sees the 401.
      if (response.status === 401) end('unauthorized');
      return response;
    },
  });

  return { session, end };
}
