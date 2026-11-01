// Attaching the edit layer to main's dialog (spec 004 edit-layer FR-380). admin-auth's entry
// reaches this file through one dynamic import, so all of it lands in the `admin-edit` chunk.
import type { ProjectDialog } from '../../components/project-dialog/project-dialog.ts';
import type { AdminSession } from '../../core/auth/session.ts';
import { loadBundled } from './bundled.ts';
import { DraftStore } from './draft-store.ts';
import { EditLayer } from './edit-layer.ts';
import { installInline } from './inline.ts';
import { Lifecycle } from './lifecycle.ts';
import { installPanel } from './panel-wiring.ts';
import { Publisher } from './publish-flow.ts';
import { ToolbarController } from './toolbar-wiring.ts';
import { Validation } from './validation.ts';

/** main's instance comes from the public graph, so it is checked by shape, not `instanceof`. */
const isDialogHost = (node: HTMLElement): node is ProjectDialog =>
  'show' in node && typeof node.show === 'function' && 'isOpen' in node;

/** Finds main's dialog instance: an intent on #wall loads it, then it's defined (FR-380). */
async function findDialog(): Promise<{ host: ProjectDialog; modal: HTMLDialogElement }> {
  document.getElementById('wall')?.dispatchEvent(new CustomEvent('timeline:intent'));
  await customElements.whenDefined('project-dialog');
  const find = (): HTMLElement | null => document.querySelector('project-dialog');
  let host = find();
  while (host === null) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    host = find();
  }
  const modal = host.querySelector('dialog');
  if (modal === null || !isDialogHost(host)) throw new Error('edit-layer: no project dialog');
  return { host, modal };
}

/** The editor's parts, so later surfaces (panel, dialogs, publish) can reach each other. */
export interface Editor {
  readonly layer: EditLayer;
  readonly validation: Validation;
  readonly toolbar: ToolbarController;
  readonly publisher: Publisher;
  readonly lifecycle: Lifecycle;
}

/**
 * The entry point admin-auth calls after the public app boots (FR-380). `requested` is the path
 * before the router ran, so a create draft's deep link can reopen (FR-393).
 */
export async function attach(
  session: AdminSession,
  requested: string = location.pathname,
): Promise<Editor> {
  let layer: EditLayer | null = null;
  const store = await DraftStore.open({ onProblem: (p) => layer?.storeProblem(p) });
  const [{ host, modal }, bundled] = await Promise.all([findDialog(), loadBundled()]);
  layer = new EditLayer(session, store, host, modal, bundled);
  if (!store.persistent) layer.storeProblem('fallback');
  const attached = layer;
  document.addEventListener('admin:signed-in', (event) => {
    attached.session = event.detail;
  });
  const validation = new Validation(layer);
  const toolbar = new ToolbarController(layer, validation);
  installInline(layer, validation);
  const publisher = new Publisher(layer, toolbar);
  const lifecycle = new Lifecycle(layer, toolbar, publisher);
  installPanel(layer, validation, toolbar, (slug) => lifecycle.rename(slug));
  if (modal.open) layer.sync();
  else await lifecycle.reopen(requested);
  return { layer, validation, toolbar, publisher, lifecycle };
}
