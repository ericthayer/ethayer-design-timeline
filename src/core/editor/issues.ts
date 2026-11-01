// Validator issues in the editor (spec 004 edit-layer FR-395): issue → field mapping, counts, and
// the publish gate. Pure.
import type { Issue } from '../../content/validate/index.ts';

export type Gate = 'go' | 'confirm' | 'blocked';

export interface IssueCounts {
  readonly errors: number;
  readonly warnings: number;
}

export function countIssues(issues: readonly Issue[]): IssueCounts {
  const errors = issues.filter((i) => i.severity === 'error').length;
  return { errors, warnings: issues.length - errors };
}

/** Errors block Publish; warnings need "Publish anyway" every time (FR-395). */
export function gateOf(issues: readonly Issue[]): Gate {
  const { errors, warnings } = countIssues(issues);
  if (errors > 0) return 'blocked';
  return warnings > 0 ? 'confirm' : 'go';
}

/** True when `prefix` is `path` or a whole-segment prefix of it (`/gallery/2` of `/gallery/2/label`). */
const covers = (prefix: string, path: string): boolean =>
  prefix !== '' && (path === prefix || path.startsWith(`${prefix}/`));

/**
 * The control an issue belongs to: the longest `data-pointer` that covers the issue's path, in
 * the same file. Null means the issue is listed only in the toolbar's Issues panel.
 */
export function fieldFor(issue: Issue, file: string, pointers: Iterable<string>): string | null {
  if (issue.file !== file) return null;
  let best: string | null = null;
  for (const pointer of pointers) {
    if (covers(pointer, issue.path) && (best === null || pointer.length > best.length)) {
      best = pointer;
    }
  }
  return best;
}

export interface Placed {
  /** Issues per control pointer. */
  readonly byField: ReadonlyMap<string, readonly Issue[]>;
  /** Issues with no control, or in another file. */
  readonly unplaced: readonly Issue[];
}

/** Splits issues into those shown on a control and those listed only in the Issues panel. */
export function placeIssues(
  issues: readonly Issue[],
  file: string,
  pointers: Iterable<string>,
): Placed {
  const list = [...pointers];
  const byField = new Map<string, Issue[]>();
  const unplaced: Issue[] = [];
  for (const issue of issues) {
    const field = fieldFor(issue, file, list);
    if (field === null) unplaced.push(issue);
    else byField.set(field, [...(byField.get(field) ?? []), issue]);
  }
  return { byField, unplaced };
}
