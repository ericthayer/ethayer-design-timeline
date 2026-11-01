// Wires <admin-panel> to the layer (spec 004 edit-layer FR-388–FR-390, FR-395): the toolbar's
// Card settings toggles it, every control change is one op, and issues land on its controls.
import {
  AdminPanel,
  type PanelContext,
  define as definePanel,
} from '../../components/admin-panel/admin-panel.ts';
import { validationContext } from '../../core/editor/changes.ts';
import { projectFile } from '../../content/paths.ts';
import { EDITOR_CONTEXT } from './bundled.ts';
import type { EditLayer } from './edit-layer.ts';
import type { ToolbarController } from './toolbar-wiring.ts';
import type { Validation } from './validation.ts';

declare global {
  interface HTMLElementEventMap {
    /** Danger zone's Delete: the confirmation flow (T391) listens on the modal. */
    'editor:delete': CustomEvent<string>;
  }
}

const SETTINGS_KEY = 'settings';

type Rename = (slug: string) => string | null;

/** The open project's keys, sorted: manifest ∪ staged, filtered to `<slug>/` (FR-389). */
function keysFor(layer: EditLayer, slug: string): { images: string[]; videos: string[] } {
  const draft = layer.draft;
  const vctx = validationContext(EDITOR_CONTEXT, draft?.staged ?? []);
  const mine = (keys: ReadonlySet<string> | null): string[] =>
    [...(keys ?? [])].filter((k) => k.startsWith(`${slug}/`)).sort();
  return { images: mine(vctx.mediaKeys), videos: mine(vctx.videoKeys) };
}

function contextOf(layer: EditLayer, rename: Rename | null): PanelContext | null {
  const draft = layer.draft;
  if (draft === null || layer.readOnly !== null) return null;
  const { images, videos } = keysFor(layer, draft.slug);
  return {
    slug: draft.slug,
    working: draft.working,
    order: draft.order,
    imageKeys: images,
    videoKeys: videos,
    apply(op) {
      layer.dispatch(op);
      layer.endGroup();
    },
    ...(draft.action === 'create' && rename !== null ? { rename } : {}),
    requestDelete() {
      layer.modal.dispatchEvent(new CustomEvent('editor:delete', { detail: draft.slug }));
    },
  };
}

export function installPanel(
  layer: EditLayer,
  validation: Validation,
  toolbar: ToolbarController,
  rename: Rename | null = null,
): AdminPanel {
  definePanel();
  const panel = new AdminPanel();
  layer.keepInDialog(panel);
  const refresh = (): void => {
    panel.context = contextOf(layer, rename);
    panel.previewValid = layer.previewValid;
    panel.issues = validation.built?.issues ?? [];
    panel.file = layer.slug === null ? '' : projectFile(layer.slug);
    if (panel.context === null && panel.isOpen) panel.close();
    panel.render();
  };
  const setOpen = (open: boolean): void => {
    toolbar.panelOpen = open;
    toolbar.update();
  };
  layer.addEventListener('change', refresh);
  validation.addEventListener('validated', () => {
    panel.issues = validation.built?.issues ?? [];
    panel.showErrors();
  });
  layer.modal.addEventListener('editor:action', (event) => {
    if (event.detail.kind !== SETTINGS_KEY) return;
    if (panel.isOpen) {
      panel.close();
      return;
    }
    refresh();
    if (panel.context === null) return;
    panel.tile = null;
    panel.open();
    setOpen(true);
  });
  layer.modal.addEventListener('editor:go-to', (event) => {
    refresh();
    if (panel.context === null) return;
    panel.goTo(event.detail);
    setOpen(true);
  });
  // Close or Esc: focus goes back to the toolbar's Card settings toggle (FR-388).
  panel.addEventListener('admin-panel:close', () => {
    setOpen(false);
    toolbar.toolbar.control(SETTINGS_KEY)?.focus();
  });
  refresh();
  return panel;
}
