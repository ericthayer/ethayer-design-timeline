// Tree payloads and base64 (spec 004 github-publish FR-365, FR-366). Pure.
import type { FileChange, WireTreeEntry } from './types.ts';

/** One `POST git/trees` entry. `sha: null` deletes the path from `base_tree` (FR-366). */
export interface TreeEntry {
  readonly path: string;
  readonly mode: '100644';
  readonly type: 'blob';
  readonly sha: string | null;
}

export interface Upload {
  readonly path: string;
  readonly sha: string;
}

/** Uploads first, then deletions, each in path order, so payloads are stable. */
export function treeEntries(uploads: readonly Upload[], deletions: readonly string[]): TreeEntry[] {
  const byPath = (a: { path: string }, b: { path: string }): number =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  const puts = [...uploads].sort(byPath).map(
    ({ path, sha }): TreeEntry => ({ path, mode: '100644', type: 'blob', sha }),
  );
  const dels = [...deletions].sort().map(
    (path): TreeEntry => ({ path, mode: '100644', type: 'blob', sha: null }),
  );
  return [...puts, ...dels];
}

export const needsTree = (changes: readonly FileChange[]): boolean =>
  changes.some((c) => c.kind === 'delete' || c.kind === 'delete-dir');

/**
 * The files to delete, given the base tree's recursive listing. A `delete` of a missing file is
 * dropped (idempotent). `delete-dir` expands by prefix, skipping paths this request also uploads.
 */
export function expandDeletes(
  changes: readonly FileChange[],
  base: readonly WireTreeEntry[],
): string[] {
  const present = base.filter((e) => e.type === 'blob').map((e) => e.path);
  const presentSet = new Set(present);
  const uploads = new Set(
    changes.filter((c) => c.kind === 'put' || c.kind === 'put-binary').map((c) => c.path),
  );
  const out = new Set<string>();
  for (const change of changes) {
    if (change.kind === 'delete' && presentSet.has(change.path)) out.add(change.path);
    if (change.kind === 'delete-dir') {
      for (const path of present) {
        if (path.startsWith(change.path) && !uploads.has(path)) out.add(path);
      }
    }
  }
  return [...out].sort();
}

/** A multiple of 3, so each chunk encodes without padding. */
const CHUNK = 3 * 8192;

/** `Uint8Array.prototype.toBase64` when the browser has it, otherwise chunked `btoa`. */
export function toBase64(bytes: Uint8Array): string {
  const native: unknown = Reflect.get(bytes, 'toBase64');
  if (typeof native === 'function') {
    const out: unknown = Reflect.apply(native, bytes, []);
    if (typeof out === 'string') return out;
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += btoa(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return out;
}

/** GitHub wraps base64 content with newlines. Throws on input that isn't base64. */
export function fromBase64(text: string): Uint8Array {
  const binary = atob(text.replace(/\s+/g, ''));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
