// The dialog view for a draft (spec 004 edit-layer FR-381, FR-393). A project the bundle doesn't
// list yet (a create) opens with Prev and Next disabled.
import type { DialogView } from '../../components/project-dialog/project-dialog.ts';
import { buildWallItems, projectSequence } from '../../core/order.ts';
import type { Project } from '../../content/types.ts';
import { BUNDLED, ERAS } from './bundled.ts';

const SEQUENCE = projectSequence(buildWallItems(BUNDLED.projects, ERAS));

export function dialogView(project: Project): DialogView {
  const index = SEQUENCE.findIndex((p) => p.slug === project.slug);
  const listed = index >= 0;
  return {
    project,
    index: listed ? index + 1 : 1,
    total: SEQUENCE.length + (listed ? 0 : 1),
    era: ERAS.find((era) => era.id === project.era),
    prev: listed ? SEQUENCE[index - 1] : undefined,
    next: listed ? SEQUENCE[index + 1] : undefined,
  };
}
