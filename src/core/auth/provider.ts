import { createSession, type AdminSession, type SessionHandle } from './session.ts';
import { createTokenStore, type TokenStore } from './token-store.ts';
import { precheck, verifyToken, type AuthFailure, type FetchLike } from './verify.ts';

export type SignInOutcome = { readonly ok: true; readonly session: AdminSession } | AuthFailure;

/**
 * The seam `entry.ts` talks to (spec 004 admin-auth FR-359). v1 ships `patProvider`; a later
 * OAuth provider replaces it without changing `AdminSession` or its consumers.
 */
export interface AuthProvider {
  /** Re-verify a stored session. null when there is nothing to restore. */
  restore(): Promise<SignInOutcome | null>;
  signIn(input: string): Promise<SignInOutcome>;
  /** Ends the session with reason 'user'. Navigation is the caller's job (FR-353). */
  signOut(): void;
  /** False when the browser refused sessionStorage, so a reload needs the token again. */
  readonly persistent: boolean;
}

export interface PatProviderDeps {
  readonly fetch?: FetchLike;
  readonly store?: TokenStore;
  readonly now?: () => number;
}

/** Fine-grained personal access token, verified against GitHub (FR-346–FR-350). */
export function patProvider(deps: PatProviderDeps = {}): AuthProvider {
  const store = deps.store ?? createTokenStore();
  const verifyDeps = {
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
    ...(deps.now ? { now: deps.now } : {}),
  };
  let handle: SessionHandle | null = null;

  const start = (token: string, login: string, expiresAt: Date | null): SignInOutcome => {
    handle?.end('user');
    store.write({ v: 1, token, login, expiresAt: expiresAt?.toISOString() ?? null });
    handle = createSession({
      token,
      login,
      expiresAt,
      store,
      ...(deps.fetch ? { fetch: deps.fetch } : {}),
    });
    return { ok: true, session: handle.session };
  };

  return {
    get persistent(): boolean {
      return store.persistent;
    },

    async restore(): Promise<SignInOutcome | null> {
      const stored = store.read();
      if (!stored) return null;
      const storedExpiresAt = stored.expiresAt === null ? null : new Date(stored.expiresAt);
      const result = await verifyToken(stored.token, { ...verifyDeps, storedExpiresAt });
      if (!result.ok) {
        store.clear();
        return result;
      }
      return start(stored.token, result.login, result.expiresAt ?? storedExpiresAt);
    },

    async signIn(input: string): Promise<SignInOutcome> {
      const checked = precheck(input);
      if (!checked.ok) return checked;
      const result = await verifyToken(checked.token, verifyDeps);
      // Nothing is stored for a refused token (D6 wrong-account included).
      if (!result.ok) return result;
      return start(checked.token, result.login, result.expiresAt);
    },

    signOut(): void {
      if (handle) handle.end('user');
      else store.clear();
      handle = null;
    },
  };
}
