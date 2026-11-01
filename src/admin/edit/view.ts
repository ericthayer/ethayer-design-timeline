// The dialog view for a draft (spec 004 edit-layer FR-381, FR-393). A project the bundle doesn't
// list yet (a create) opens with Prev and Next disabled.
import type { DialogView } from '../../components/project-dialog/project-dialog.ts';
import { buildWallItems, projectSequence } from '../../core/order.ts';
import type { Project } from '../../content/types.ts';
import { ERAS } from './bundled.ts';

/** The wall's project sequence, as Prev and Next walk it. */
export const sequenceOf = (projects: readonly Project[]): readonly Project[] =>
  projectSequence(buildWallItems(projects, ERAS));

export function dialogView(project: Project, sequence: readonly Project[]): DialogView {
  const index = sequence.findIndex((p) => p.slug === project.slug);
  const listed = index >= 0;
  return {
    project,
    index: listed ? index + 1 : 1,
    total: sequence.length + (listed ? 0 : 1),
    era: ERAS.find((era) => era.id === project.era),
    prev: listed ? sequence[index - 1] : undefined,
    next: listed ? sequence[index + 1] : undefined,
  };
}

/** What identifies a control across renders: its focus key, else its field pointer. */
export function focusKeyOf(node: HTMLElement): string | null {
  const keyed = node.closest<HTMLElement>('[data-focus-key]')?.dataset['focusKey'];
  return keyed ?? node.closest<HTMLElement>('[data-pointer]')?.dataset['pointer'] ?? null;
}
export const focusSelector = (key: string): string =>
  `[data-focus-key="${CSS.escape(key)}"], [data-pointer="${CSS.escape(key)}"]`;

const EDIT_KEY = 'timeline:admin-edit';

/** Edit mode survives reloads (FR-382); storage is a convenience only. */
export function readEditing(): boolean {
  try {
    return localStorage.getItem(EDIT_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeEditing(on: boolean): void {
  document.documentElement.dataset['adminEdit'] = on ? 'on' : 'off';
  try {
    localStorage.setItem(EDIT_KEY, on ? 'on' : 'off');
  } catch {
    // The preference is a convenience only.
  }
}
