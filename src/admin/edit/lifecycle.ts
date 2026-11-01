// Create and delete (spec 004 edit-layer FR-393, FR-394): the New project form opens a create
// draft in the real dialog, and Delete confirms, publishes one commit, and closes the dialog.
import { AdminCreate, define as defineCreate } from '../../components/admin-create/admin-create.ts';
import { confirmDialog } from '../../components/admin-confirm/admin-confirm.ts';
import { CONTENT_FILES } from '../../content/paths.ts';
import { parseJson } from '../../content/validate/issue.ts';
import { isRecord } from '../../content/validate/read.ts';
import { buildDelete } from '../../core/editor/changes.ts';
import { deleteConfirm, discardConfirm } from '../../core/editor/confirm.ts';
import {
  createDraft,
  freeMotif,
  listedSlugs,
  newProject,
  renameCreate,
  slugProblem,
  type CreateFields,
} from '../../core/editor/create.ts';
import { readFile, readHead } from '../../core/github/index.ts';
import { parseSlug, routerBase, workPath } from '../../core/router.ts';
import { EDITOR_CONTEXT, ERAS } from './bundled.ts';
import type { EditLayer } from './edit-layer.ts';
import type { Publisher } from './publish-flow.ts';
import { assembleRaw, readOrder } from './snapshot.ts';
import type { ToolbarController } from './toolbar-wiring.ts';

/** The router's own history shape, so its Close pops the entry the layer pushed. */
function pushWork(slug: string, replace: boolean): void {
  const path = routerBase(location.pathname) + workPath(slug);
  const prev: unknown = history.state;
  const pushedByApp = replace ? isRecord(prev) && prev['pushedByApp'] === true : true;
  const state = { path, pushedByApp };
  if (replace) history.replaceState(state, '', path);
  else history.pushState(state, '', path);
}

/** Closes the dialog the way its Close button does, so the router follows. */
const closeDialog = (layer: EditLayer): void => {
  layer.modal.querySelector<HTMLButtonElement>('[data-close]')?.click();
};

export class Lifecycle {
  readonly form: AdminCreate;
  readonly #layer: EditLayer;
  readonly #toolbar: ToolbarController;
  readonly #publisher: Pick<Publisher, 'run'>;
  readonly #taken = new Set<string>();

  constructor(layer: EditLayer, toolbar: ToolbarController, publisher: Pick<Publisher, 'run'>) {
    this.#layer = layer;
    this.#toolbar = toolbar;
    this.#publisher = publisher;
    defineCreate();
    this.form = new AdminCreate();
    this.form.eras = ERAS;
    this.form.checkSlug = (slug) => slugProblem(slug, this.#taken);
    document.body.append(this.form);
    this.form.addEventListener('admin-create:submit', (event) => {
      void this.create(event.detail);
    });
    layer.modal.addEventListener('editor:action', (event) => {
      if (event.detail.kind === 'new') this.openForm();
    });
    layer.modal.addEventListener('editor:delete', (event) => {
      void this.delete(event.detail);
    });
    // main's router knows nothing of a create, so the layer handles its Close and Esc (FR-393).
    // Capture on document runs before main's listener on the dialog host.
    document.addEventListener('project-dialog:close', this.#onClose, { capture: true });
  }

  readonly #onClose = (event: Event): void => {
    const layer = this.#layer;
    if (layer.draft?.action !== 'create' || !layer.modal.open) return;
    event.stopPropagation();
    const state: unknown = history.state;
    layer.host.hide();
    if (isRecord(state) && state['pushedByApp'] === true) history.back();
    else history.replaceState(null, '', routerBase(location.pathname) || '/');
    this.#toolbar.toolbar.control('new')?.focus();
  };

  /** Bundle, repo `order.json`, and local drafts: a new slug must be none of them (FR-393). */
  openForm(): void {
    this.form.open();
    this.#refreshTaken();
  }

  #refreshTaken(): void {
    for (const p of this.#layer.bundled.projects) this.#taken.add(p.slug);
    void this.#layer.store.slugs().then((slugs) => {
      for (const s of slugs) this.#taken.add(s);
    });
    const session = this.#layer.session;
    void readHead(session).then(async (head) => {
      if (head.kind !== 'ok') return;
      const file = await readFile(session, CONTENT_FILES.order, head.sha);
      if (file.kind !== 'ok') return;
      for (const s of listedSlugs(readOrder(parseJson(file.text)))) this.#taken.add(s);
    });
  }

  /** A create draft under a new slug, before its first publish (FR-393). */
  rename(slug: string): string | null {
    const layer = this.#layer;
    const draft = layer.draft;
    if (draft?.action !== 'create' || slug === draft.slug) return null;
    const problem = slugProblem(slug, this.#taken);
    if (problem !== null) return problem;
    const next = renameCreate(draft, slug);
    void layer.store.clear(draft.slug);
    pushWork(slug, true);
    layer.focusNext = 'slug';
    layer.replaceDraft(next, assembleRaw(slug, next.base.files, layer.bundled));
    return null;
  }

  #fail(text: string): void {
    this.#layer.notice = text;
    this.#toolbar.update();
  }

  /** A create draft on the repo head, previewed in the dialog with focus on its title. */
  async create(fields: CreateFields): Promise<void> {
    const layer = this.#layer;
    const head = await readHead(layer.session);
    const file =
      head.kind === 'ok' ? await readFile(layer.session, CONTENT_FILES.order, head.sha) : head;
    if (head.kind !== 'ok' || file.kind !== 'ok') {
      this.#fail("Couldn't read the repository. Your new project wasn't created; try again.");
      return;
    }
    const working = newProject(fields, freeMotif(layer.bundled.projects), new Date());
    const order = readOrder(parseJson(file.text));
    const draft = createDraft(working, head.sha, order, file.text);
    pushWork(draft.slug, false);
    layer.focusNext = '/title';
    layer.replaceDraft(draft, assembleRaw(draft.slug, draft.base.files, layer.bundled), true);
  }

  /** Reopens a create draft from its deep link, after the router's "not found" reset (FR-393). */
  async reopen(requested: string): Promise<void> {
    const layer = this.#layer;
    const slug = parseSlug(requested.slice(routerBase(requested).length) || '/');
    if (slug === null || layer.bundled.projects.some((p) => p.slug === slug)) return;
    const draft = await layer.store.load(slug);
    if (draft?.action !== 'create' || layer.modal.open) return;
    this.#refreshTaken();
    pushWork(slug, true);
    layer.replaceDraft(draft, assembleRaw(slug, draft.base.files, layer.bundled), true);
  }

  /** Delete (FR-394): an unpublished create is only discarded; anything else is one commit. */
  async delete(slug: string): Promise<void> {
    const layer = this.#layer;
    const draft = layer.draft;
    const raw = layer.raw;
    if (draft === null || raw === null || draft.slug !== slug) return;
    const ask = confirmDialog();
    if (draft.action === 'create') {
      if ((await ask.ask(discardConfirm(slug, layer.changes))) !== 'discard') return;
      await layer.store.clear(slug, draft.staged);
      closeDialog(layer);
      return;
    }
    const built = buildDelete(raw, slug, EDITOR_CONTEXT);
    if (built.gate === 'blocked') {
      const errors = built.issues.filter((i) => i.severity === 'error');
      this.#fail(`Can't delete ${slug}: ${errors.map((i) => `${i.file}: ${i.message}`).join(' ')}`);
      return;
    }
    const warnings = built.issues.filter((i) => i.severity === 'warning');
    if ((await ask.ask(deleteConfirm(slug, warnings))) !== 'delete') return;
    const result = await this.#publisher.run(built.changes, 'delete', slug, draft.base.sha);
    if (result?.kind !== 'ok') return;
    await layer.store.clear(slug, draft.staged);
    closeDialog(layer);
  }
}
