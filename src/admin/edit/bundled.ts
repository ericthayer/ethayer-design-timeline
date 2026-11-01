// What the public bundle shipped with, for the editor's validation context (spec 004 edit-layer
// FR-384, FR-392). The admin graph is separate, so these imports never touch public chunks.
import erasJson from '../../content/data/eras.json' with { type: 'json' };
import orderJson from '../../content/data/order.json' with { type: 'json' };
import resumeJson from '../../content/data/resume.json' with { type: 'json' };
import siteJson from '../../content/data/site.json' with { type: 'json' };
import imageManifest from '../../content/media-manifest.json' with { type: 'json' };
import videoManifest from '../../content/video-manifest.json' with { type: 'json' };
import { ERAS } from '../../content/eras.ts';
import { PROJECTS } from '../../content/projects/index.ts';
import type { ProjectOrder } from '../../content/types.ts';
import type { EditorContext } from '../../core/editor/changes.ts';
import { FRAME_SRC } from '../../../scripts/csp.ts';
import type { Bundled } from './snapshot.ts';

const ORDER: ProjectOrder = orderJson;

export const BUNDLED: Bundled = {
  projects: PROJECTS,
  order: ORDER,
  eras: erasJson,
  site: siteJson,
  resume: resumeJson,
};

export const EDITOR_CONTEXT: EditorContext = {
  frameOrigins: FRAME_SRC,
  images: imageManifest,
  videoKeys: new Set(Object.keys(videoManifest)),
};

export { ERAS };
