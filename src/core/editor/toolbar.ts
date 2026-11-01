// Toolbar state and its copy (spec 004 edit-layer FR-396, §6). Pure: the component only renders it.
import type { Issue } from '../../content/validate/index.ts';
import type { ConflictReason, DeployState, PublishResult } from '../github/types.ts';

export type JobStatus =
  | { readonly kind: 'none' }
  | { readonly kind: 'publishing'; readonly files: number }
  | { readonly kind: 'deploying'; readonly commitUrl: string; readonly deploy: DeployState }
  | {
      readonly kind: 'conflict';
      readonly reason: ConflictReason;
      readonly paths: readonly string[];
    }
  | {
      readonly kind: 'failed';
      readonly result: Exclude<PublishResult, { kind: 'ok' | 'unchanged' }>;
    };

export interface ToolbarState {
  readonly editing: boolean;
  readonly slug: string | null;
  readonly draft: { readonly changes: number; readonly errors: number; readonly warnings: number };
  readonly job: JobStatus;
  readonly issues: readonly Issue[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly readOnly: boolean;
  readonly panelOpen: boolean;
  /** Other projects with a local draft (FR-396 "Local drafts"). */
  readonly localDrafts: readonly string[];
  /** Behind-the-repo, storage, and load notices. */
  readonly notice: string | null;
  /** `/work/<slug>` once the deploy is live (FR-398). */
  readonly liveUrl: string | null;
}

export const EMPTY_TOOLBAR: ToolbarState = {
  editing: true,
  slug: null,
  draft: { changes: 0, errors: 0, warnings: 0 },
  job: { kind: 'none' },
  issues: [],
  canUndo: false,
  canRedo: false,
  readOnly: false,
  panelOpen: false,
  localDrafts: [],
  notice: null,
  liveUrl: null,
};

const plural = (n: number, one: string, many = `${one}s`): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/** "All changes published" / "4 unsaved changes · 2 errors · 1 warning". */
export function statusLine(state: ToolbarState): string {
  if (state.slug === null) return 'Open a project to edit it.';
  if (state.readOnly) return 'Read-only: the repository file has errors.';
  if (state.job.kind === 'publishing') return `Publishing ${plural(state.job.files, 'file')}…`;
  const { changes, errors, warnings } = state.draft;
  if (changes === 0 && errors === 0 && warnings === 0) return 'All changes published';
  const parts = [plural(changes, 'unsaved change')];
  if (errors > 0) parts.push(plural(errors, 'error'));
  if (warnings > 0) parts.push(plural(warnings, 'warning'));
  return parts.join(' · ');
}

/** Why Publish is unavailable, or null when it can be pressed (FR-395, FR-396). */
export function publishBlocked(state: ToolbarState): string | null {
  if (state.slug === null) return 'Open a project to publish it.';
  if (state.readOnly) return 'This project is read-only.';
  if (state.job.kind === 'publishing') return 'Publishing…';
  if (state.draft.errors > 0) return `Fix ${plural(state.draft.errors, 'error')} to publish.`;
  if (state.draft.changes === 0) return 'Nothing to publish yet.';
  return null;
}

export function undoBlocked(state: ToolbarState, redo: boolean): string | null {
  if (redo) return state.canRedo ? null : 'Nothing to redo.';
  return state.canUndo ? null : 'Nothing to undo.';
}

export function discardBlocked(state: ToolbarState): string | null {
  if (state.job.kind === 'publishing') return 'Publishing…';
  return state.draft.changes === 0 ? 'No changes to discard.' : null;
}

export const settingsBlocked = (state: ToolbarState): string | null =>
  state.slug === null ? 'Open a project to change its card.' : null;

export const issuesBlocked = (state: ToolbarState): string | null =>
  state.issues.length === 0 ? 'No issues.' : null;

/** "Error: title is empty" for the Issues list. */
export const issueText = (issue: Issue): string =>
  `${issue.severity === 'error' ? 'Error' : 'Warning'}: ${issue.message}`;
