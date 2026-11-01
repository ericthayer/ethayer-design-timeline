// What each confirmation dialog says (spec 004 edit-layer FR-394, FR-395, FR-397, FR-399). Pure:
// <admin-confirm> renders a spec, and the flows read back the chosen action's value.
import type { Issue } from '../../content/validate/index.ts';
import { issueText } from './toolbar.ts';

export type ConfirmBlock =
  | { readonly kind: 'p'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] };

export interface ConfirmAction<V extends string> {
  readonly value: V;
  readonly label: string;
  /** The primary action: filled, and gated by `typeToConfirm` when set. */
  readonly primary?: boolean;
}

export interface ConfirmSpec<V extends string> {
  readonly heading: string;
  readonly blocks: readonly ConfirmBlock[];
  readonly actions: readonly ConfirmAction<V>[];
  /** The text the owner types before the primary action is available (Delete). */
  readonly typeToConfirm?: string;
  readonly cancelLabel: string;
}

/** What the dialog returns: an action's value, or `cancel` for Cancel and Esc. */
export type ConfirmResult<V extends string> = V | 'cancel';

const plural = (n: number, one: string): string => `${String(n)} ${one}${n === 1 ? '' : 's'}`;

/** Warnings never block, but they always need "Publish anyway" (FR-395). */
export function warningsConfirm(warnings: readonly Issue[]): ConfirmSpec<'publish'> {
  return {
    heading: `Publish with ${plural(warnings.length, 'warning')}?`,
    blocks: [
      { kind: 'p', text: "Warnings don't block publishing. Check each one first." },
      { kind: 'list', items: warnings.map(issueText) },
    ],
    actions: [{ value: 'publish', label: 'Publish anyway', primary: true }],
    cancelLabel: 'Cancel',
  };
}

/** Discard drops the local draft and staged files (FR-385, FR-396). */
export function discardConfirm(slug: string, changes: number): ConfirmSpec<'discard'> {
  return {
    heading: `Discard changes to ${slug}?`,
    blocks: [
      {
        kind: 'p',
        text: `This drops ${plural(changes, 'unsaved change')} and any staged files. It can't be undone.`,
      },
    ],
    actions: [{ value: 'discard', label: 'Discard changes', primary: true }],
    cancelLabel: 'Keep editing',
  };
}

/** A publish conflict: reload from the repository, or keep the draft on the new base (FR-397). */
export function conflictConfirm(paths: readonly string[]): ConfirmSpec<'reload' | 'keep'> {
  return {
    heading: 'Files changed on GitHub',
    blocks: [
      { kind: 'p', text: 'These files changed on GitHub since you started:' },
      { kind: 'list', items: paths },
      {
        kind: 'p',
        text: 'Reload from repository drops your draft. Keep my draft replaces those changes the next time you publish.',
      },
    ],
    actions: [
      { value: 'reload', label: 'Reload from repository' },
      { value: 'keep', label: 'Keep my draft', primary: true },
    ],
    cancelLabel: 'Decide later',
  };
}

/** Delete: what goes, any plan warnings, and the slug typed to confirm (FR-394). */
export function deleteConfirm(slug: string, warnings: readonly Issue[]): ConfirmSpec<'delete'> {
  return {
    heading: `Delete ${slug}?`,
    blocks: [
      { kind: 'p', text: 'One commit to main removes:' },
      {
        kind: 'list',
        items: ['its JSON file', 'its place in order.json', `every file in media-src/${slug}/`],
      },
      ...(warnings.length > 0
        ? [{ kind: 'list', items: warnings.map(issueText) } satisfies ConfirmBlock]
        : []),
    ],
    actions: [{ value: 'delete', label: 'Delete and publish', primary: true }],
    typeToConfirm: slug,
    cancelLabel: 'Cancel',
  };
}
