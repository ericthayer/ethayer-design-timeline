// What the public bundle shipped with, for the editor's validation context (spec 004 edit-layer
// FR-384, FR-392). The admin graph is separate, so these imports never touch public chunks.
// Project files are static assets fetched on first edit, not JS: they'd cost ~7 KB gzip of
// admin JS (edit-layer FR-380 budget).
import erasJson from '../../content/data/eras.json' with { type: 'json' };
import orderJson from '../../content/data/order.json' with { type: 'json' };
import resumeJson from '../../content/data/resume.json' with { type: 'json' };
import siteJson from '../../content/data/site.json' with { type: 'json' };
import imageManifest from '../../content/media-manifest.json' with { type: 'json' };
import videoManifest from '../../content/video-manifest.json' with { type: 'json' };
import { ERAS } from '../../content/eras.ts';
import { projectFile } from '../../content/paths.ts';
import type { Project, ProjectOrder } from '../../content/types.ts';
import { validateProject } from '../../content/validate/project.ts';
import { type EditorContext, validationContext } from '../../core/editor/changes.ts';
import { FRAME_SRC } from '../../../scripts/csp.ts';
import type { Bundled } from './snapshot.ts';

const ORDER: ProjectOrder = orderJson;

/** Hashed asset URLs, one per project file, keyed by glob path. */
const PROJECT_URLS = import.meta.glob<string>('../../content/data/projects/*.json', {
  query: '?url',
  import: 'default',
  eager: true,
});

export const EDITOR_CONTEXT: EditorContext = {
  frameOrigins: FRAME_SRC,
  images: imageManifest,
  videoKeys: new Set(Object.keys(videoManifest)),
};

/** Fetches one shipped project file; a missing or invalid one is left out. */
async function loadProject(slug: string, load: typeof fetch): Promise<Project | null> {
  const url = PROJECT_URLS[`../../content/data/projects/${slug}.json`];
  if (url === undefined) return null;
  try {
    const response = await load(url);
    if (!response.ok) return null;
    const raw: unknown = await response.json();
    const result = validateProject(raw, projectFile(slug), validationContext(EDITOR_CONTEXT, []));
    return result.ok ? result.value : null;
  } catch {
    return null;
  }
}

/** The bundle's projects, in `order.json` order, plus its other documents. */
export async function loadBundled(load: typeof fetch = fetch): Promise<Bundled> {
  const slugs = Object.values(ORDER).flat();
  const projects = await Promise.all(slugs.map((slug) => loadProject(slug, load)));
  return {
    projects: projects.filter((p): p is Project => p !== null),
    order: ORDER,
    eras: erasJson,
    site: siteJson,
    resume: resumeJson,
  };
}

export { ERAS };
