// Local drafts (spec 004 edit-layer FR-385): IndexedDB `timeline-admin` v1 with a `drafts` store
// keyed `[slug, baseSha]` and a `blobs` store keyed by repo path. Saves are debounced, every call
// is guarded, and a memory store stands in when IndexedDB is unavailable. The token is never
// stored: a Draft has no session field (admin-auth FR-349).
import type { Draft, StagedFile } from '../../core/editor/draft.ts';
import { isRecord } from '../../content/validate/read.ts';

type StoreName = 'drafts' | 'blobs';

/** The storage seam: IndexedDB in the browser, memory in tests and as the fallback. */
export interface Backend {
  get(store: StoreName, key: IDBValidKey): Promise<unknown>;
  put(store: StoreName, key: IDBValidKey, value: unknown): Promise<void>;
  delete(store: StoreName, key: IDBValidKey): Promise<void>;
  keys(store: StoreName): Promise<readonly IDBValidKey[]>;
}

export function memoryBackend(): Backend {
  const stores: Record<StoreName, Map<string, { key: IDBValidKey; value: unknown }>> = {
    drafts: new Map(),
    blobs: new Map(),
  };
  const id = (key: IDBValidKey): string => JSON.stringify(key);
  return {
    get: (store, key) => Promise.resolve(stores[store].get(id(key))?.value),
    put: (store, key, value) => {
      stores[store].set(id(key), { key, value });
      return Promise.resolve();
    },
    delete: (store, key) => {
      stores[store].delete(id(key));
      return Promise.resolve();
    },
    keys: (store) => Promise.resolve([...stores[store].values()].map((e) => e.key)),
  };
}

const done = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'));
    };
  });

/** Opens `timeline-admin` v1. Rejects when IndexedDB is missing or blocked. */
export async function indexedDbBackend(factory: IDBFactory = indexedDB): Promise<Backend> {
  const open = factory.open('timeline-admin', 1);
  open.onupgradeneeded = () => {
    const db = open.result;
    if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts');
    if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
  };
  const db = await done(open);
  const store = (name: StoreName, mode: IDBTransactionMode): IDBObjectStore =>
    db.transaction(name, mode).objectStore(name);
  return {
    get: (name, key) => done(store(name, 'readonly').get(key)),
    put: async (name, key, value) => {
      await done(store(name, 'readwrite').put(value, key));
    },
    delete: async (name, key) => {
      await done(store(name, 'readwrite').delete(key));
    },
    keys: (name) => done(store(name, 'readonly').getAllKeys()),
  };
}

const isStaged = (v: unknown): v is StagedFile =>
  isRecord(v) && typeof v['path'] === 'string' && typeof v['key'] === 'string';

/** A structural check of a stored draft. Anything else is ignored, never trusted. */
export function isDraft(v: unknown): v is Draft {
  if (!isRecord(v) || v['v'] !== 1 || typeof v['slug'] !== 'string') return false;
  const base = v['base'];
  const staged = v['staged'];
  return (
    (v['action'] === 'create' || v['action'] === 'update') &&
    isRecord(base) &&
    typeof base['sha'] === 'string' &&
    isRecord(base['files']) &&
    isRecord(v['working']) &&
    isRecord(v['order']) &&
    Array.isArray(staged) &&
    staged.every(isStaged) &&
    typeof v['savedAt'] === 'number'
  );
}

const draftKey = (d: Pick<Draft, 'slug' | 'base'>): [string, string] => [d.slug, d.base.sha];
const isDraftKey = (k: IDBValidKey): k is [string, string] =>
  Array.isArray(k) && k.length === 2 && typeof k[0] === 'string' && typeof k[1] === 'string';

export type SaveResult = 'saved' | 'conflict';
/** `fallback`: storage threw, so drafts now live in memory ("Drafts won't survive a reload here"). */
export type StoreProblem = 'conflict' | 'fallback';

export interface DraftStoreOptions {
  readonly debounceMs?: number;
  readonly now?: () => number;
  /** Called when another tab saved a newer copy, or when storage fails over to memory. */
  readonly onProblem?: (problem: StoreProblem) => void;
}

export class DraftStore {
  #persistent: boolean;
  #backend: Backend;
  readonly #debounceMs: number;
  readonly #now: () => number;
  readonly #onProblem: (problem: StoreProblem) => void;
  /** The `savedAt` this tab last read or wrote, per draft key. */
  readonly #known = new Map<string, number>();
  #timer: ReturnType<typeof setTimeout> | null = null;
  #pending: Draft | null = null;

  constructor(backend: Backend, persistent: boolean, options: DraftStoreOptions = {}) {
    this.#backend = backend;
    this.#persistent = persistent;
    this.#debounceMs = options.debounceMs ?? 500;
    this.#now = options.now ?? Date.now;
    this.#onProblem = options.onProblem ?? (() => undefined);
  }

  /** False once drafts live in memory only: the toolbar warns and `beforeunload` guards. */
  get persistent(): boolean {
    return this.#persistent;
  }

  /** Storage threw: keep going in memory, and say so once. */
  #fallBack(): void {
    if (!this.#persistent) return;
    this.#backend = memoryBackend();
    this.#persistent = false;
    this.#onProblem('fallback');
  }

  /** IndexedDB when it opens, memory otherwise (`persistent: false` drives the toolbar warning). */
  static async open(options: DraftStoreOptions = {}): Promise<DraftStore> {
    try {
      return new DraftStore(await indexedDbBackend(), true, options);
    } catch {
      const store = new DraftStore(memoryBackend(), false, options);
      options.onProblem?.('fallback');
      return store;
    }
  }

  /** The newest valid draft for a slug, or null. */
  async load(slug: string): Promise<Draft | null> {
    try {
      let best: Draft | null = null;
      for (const key of await this.#backend.keys('drafts')) {
        if (!isDraftKey(key) || key[0] !== slug) continue;
        const value = await this.#backend.get('drafts', key);
        if (isDraft(value) && (best === null || value.savedAt > best.savedAt)) best = value;
      }
      if (best !== null) this.#known.set(JSON.stringify(draftKey(best)), best.savedAt);
      return best;
    } catch {
      return null;
    }
  }

  /** Slugs with a local draft, for the toolbar's "Local drafts" links. */
  async slugs(): Promise<string[]> {
    try {
      const keys = await this.#backend.keys('drafts');
      return [...new Set(keys.filter(isDraftKey).map((k) => k[0]))].sort();
    } catch {
      return [];
    }
  }

  /** Schedules a save 500 ms out. A newer call replaces the pending draft. */
  save(draft: Draft): void {
    this.#pending = draft;
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      void this.flush();
    }, this.#debounceMs);
  }

  /** Writes the pending draft now (blur, before Publish, `pagehide`). */
  async flush(): Promise<SaveResult | null> {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    const draft = this.#pending;
    this.#pending = null;
    return draft === null ? null : this.write(draft);
  }

  /** Saves at once, unless another tab saved a newer copy (`savedAt` guard). */
  async write(draft: Draft): Promise<SaveResult> {
    try {
      return await this.#write(draft);
    } catch {
      this.#fallBack();
      return this.#write(draft);
    }
  }

  async #write(draft: Draft): Promise<SaveResult> {
    const key = draftKey(draft);
    const id = JSON.stringify(key);
    const stored = await this.#backend.get('drafts', key);
    const known = this.#known.get(id) ?? draft.savedAt;
    if (isDraft(stored) && stored.savedAt > known) {
      this.#onProblem('conflict');
      return 'conflict';
    }
    const savedAt = Math.max(this.#now(), known + 1);
    await this.#backend.put('drafts', key, { ...draft, savedAt });
    this.#known.set(id, savedAt);
    for (const other of await this.#backend.keys('drafts')) {
      if (isDraftKey(other) && other[0] === draft.slug && other[1] !== draft.base.sha) {
        await this.#backend.delete('drafts', other);
      }
    }
    return 'saved';
  }

  /** Drops every draft for a slug and the blobs it staged (ok, unchanged, Discard, delete). */
  async clear(slug: string, staged: readonly StagedFile[] = []): Promise<void> {
    if (this.#pending?.slug === slug) this.#pending = null;
    try {
      for (const key of await this.#backend.keys('drafts')) {
        if (isDraftKey(key) && key[0] === slug) await this.#backend.delete('drafts', key);
      }
      for (const file of staged) await this.#backend.delete('blobs', file.path);
    } catch {
      // A leftover draft is harmless: it is ignored once its base sha is stale.
    }
  }

  async putBlob(path: string, file: Blob): Promise<void> {
    try {
      await this.#backend.put('blobs', path, file);
    } catch {
      this.#fallBack();
      await this.#backend.put('blobs', path, file);
    }
  }

  async getBlob(path: string): Promise<Blob | null> {
    try {
      const value = await this.#backend.get('blobs', path);
      return value instanceof Blob ? value : null;
    } catch {
      return null;
    }
  }

  async deleteBlob(path: string): Promise<void> {
    try {
      await this.#backend.delete('blobs', path);
    } catch {
      // Ignored: an orphaned blob is never sent, because only staged paths are read.
    }
  }
}
