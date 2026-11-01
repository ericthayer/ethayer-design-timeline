// A real <project-dialog> under happy-dom with an edit layer on it (spec 004 edit-layer units).
import { DraftStore, memoryBackend } from '../../../src/admin/edit/draft-store.ts';
import { EditLayer } from '../../../src/admin/edit/edit-layer.ts';
import type { Bundled } from '../../../src/admin/edit/snapshot.ts';
import { dialogView, sequenceOf } from '../../../src/admin/edit/view.ts';
import {
  ProjectDialog,
  define as defineDialog,
} from '../../../src/components/project-dialog/project-dialog.ts';
import { define as defineArtwork } from '../../../src/components/swiss-artwork/swiss-artwork.ts';
import erasJson from '../../../src/content/data/eras.json' with { type: 'json' };
import orderJson from '../../../src/content/data/order.json' with { type: 'json' };
import resumeJson from '../../../src/content/data/resume.json' with { type: 'json' };
import siteJson from '../../../src/content/data/site.json' with { type: 'json' };
import { PROJECTS } from '../../../src/content/projects/index.ts';
import type { AdminSession } from '../../../src/core/auth/session.ts';
import type { Draft } from '../../../src/core/editor/draft.ts';
import { asProject } from '../../../src/core/editor/preview.ts';
import { demoDraft } from './fixtures.ts';

export const session: AdminSession = {
  login: 'ericthayer',
  repo: { owner: 'o', name: 'r', branch: 'main' },
  expiresAt: null,
  authorizedFetch: () => Promise.reject(new Error('not used')),
};

/** What `loadBundled()` returns in the browser, read synchronously here. */
export const bundled: Bundled = {
  projects: PROJECTS,
  order: orderJson,
  eras: erasJson,
  site: siteJson,
  resume: resumeJson,
};

export function setup(draft: Draft = demoDraft()): {
  layer: EditLayer;
  modal: HTMLDialogElement;
  island: HTMLElement;
} {
  document.body.replaceChildren();
  defineArtwork();
  defineDialog();
  const island = document.createElement('aside');
  island.id = 'admin-island';
  const button = document.createElement('button');
  button.textContent = 'Card settings';
  island.append(button);
  document.body.append(island);
  const host = new ProjectDialog();
  document.body.append(host);
  const modal = host.querySelector('dialog');
  if (!modal) throw new Error('no dialog');
  const project = asProject(draft.working);
  if (!project) throw new Error('invalid fixture');
  host.show(dialogView(project, sequenceOf(PROJECTS)));
  const layer = new EditLayer(session, new DraftStore(memoryBackend(), true), host, modal, bundled);
  layer.replaceDraft(draft);
  return { layer, modal, island };
}
