import { STORAGE_KEY } from './config.ts';

/** What the tab keeps between reloads (spec 004 admin-auth FR-349). */
export interface StoredSession {
  readonly v: 1;
  readonly token: string;
  readonly login: string;
  /** ISO 8601, or null when GitHub doesn't expose the expiry. */
  readonly expiresAt: string | null;
}

export interface TokenStore {
  read(): StoredSession | null;
  write(session: StoredSession): void;
  clear(): void;
  /** False once sessionStorage failed: the token then lasts only until a reload. */
  readonly persistent: boolean;
}

const isStored = (value: unknown): value is StoredSession =>
  typeof value === 'object' &&
  value !== null &&
  'v' in value &&
  value.v === 1 &&
  'token' in value &&
  typeof value.token === 'string' &&
  'login' in value &&
  typeof value.login === 'string' &&
  'expiresAt' in value &&
  (value.expiresAt === null || typeof value.expiresAt === 'string');

/**
 * `sessionStorage` with an in-memory fallback. Every access is guarded, as in core/motion.ts.
 * Never localStorage, cookies, IndexedDB, or a URL.
 */
export function createTokenStore(storage: () => Storage = () => sessionStorage): TokenStore {
  let memory: StoredSession | null = null;
  let persistent = true;

  return {
    get persistent(): boolean {
      return persistent;
    },
    read(): StoredSession | null {
      if (memory) return memory;
      try {
        const raw = storage().getItem(STORAGE_KEY);
        if (raw === null) return null;
        const parsed: unknown = JSON.parse(raw);
        if (isStored(parsed)) return parsed;
        storage().removeItem(STORAGE_KEY);
        return null;
      } catch {
        // Blocked storage, or a corrupt value: nothing to restore.
        return null;
      }
    },
    write(session: StoredSession): void {
      memory = session;
      try {
        storage().setItem(STORAGE_KEY, JSON.stringify(session));
        persistent = true;
      } catch {
        persistent = false;
      }
    },
    clear(): void {
      memory = null;
      try {
        storage().removeItem(STORAGE_KEY);
      } catch {
        // Nothing was persisted.
      }
    },
  };
}
