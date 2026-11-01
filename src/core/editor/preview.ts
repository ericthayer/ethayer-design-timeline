// Preview guard (spec 004 edit-layer FR-382): the draft renders only when its size × media pair is
// a real `Project`. A unit test ties this to the validator's `size-media` rule. Pure.
import type { Project } from '../../content/types.ts';
import type { EditableProject } from './draft.ts';

/** The working copy as a renderable `Project`, or null when the size × media pair is invalid. */
export function asProject(working: EditableProject): Project | null {
  const { size, media } = working;
  switch (size) {
    case 'sm':
      return media.kind === 'iframe' ? null : { ...working, size, media };
    case 'tall':
      if (media.kind === 'iframe' && media.viewport !== 'mobile') return null;
      return { ...working, size, media };
    case 'wide':
    case 'feature':
      if (media.kind === 'iframe' && media.viewport !== 'desktop') return null;
      return { ...working, size, media };
  }
}
