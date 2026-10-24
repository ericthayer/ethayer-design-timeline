// Did `main` touch our paths since the editor loaded? (spec 004 github-publish FR-369). Pure.
import type { ConflictReason, FileChange, WireCompare } from './types.ts';

/** GitHub's compare lists at most 300 files, so a full page may be truncated. */
export const COMPARE_FILE_CAP = 300;

export type ConflictCheck =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'conflict';
      readonly reason: Exclude<ConflictReason, 'race'>;
      /** The remote paths that overlap this request, sorted. */
      readonly paths: readonly string[];
    };

/** `compare/{expected}...{head}` against the request's paths and `delete-dir` prefixes. */
export function conflictingPaths(
  compare: WireCompare,
  changes: readonly FileChange[],
): ConflictCheck {
  if (compare.status !== 'ahead') return { kind: 'conflict', reason: 'history-diverged', paths: [] };
  if (compare.files.length >= COMPARE_FILE_CAP) {
    return { kind: 'conflict', reason: 'compare-truncated', paths: [] };
  }
  const exact = new Set(changes.filter((c) => c.kind !== 'delete-dir').map((c) => c.path));
  const prefixes = changes.filter((c) => c.kind === 'delete-dir').map((c) => c.path);
  const touches = (name: string): boolean =>
    exact.has(name) || prefixes.some((prefix) => name.startsWith(prefix));
  const hits = new Set<string>();
  for (const file of compare.files) {
    for (const name of [file.filename, file.previous_filename]) {
      if (name !== undefined && touches(name)) hits.add(name);
    }
  }
  return hits.size === 0
    ? { kind: 'none' }
    : { kind: 'conflict', reason: 'paths-changed', paths: [...hits].sort() };
}
