// The edit layer (spec 004 edit-layer FR-380–FR-382). Loaded by one dynamic import from the admin
// entry. It drives main's <project-dialog> only through its public API and re-renders the real
// dialog from the draft, so the preview is the shipped UI. No public file changes.
import type { ProjectDialog } from '../../components/project-dialog/project-dialog.ts';
import type { AdminSession } from '../../core/auth/session.ts';
import { validationContext } from '../../core/editor/changes.ts';
import {
  type Draft,
  type History,
  begin,
  canRedo,
  canUndo,
  changeCount,
  endGroup,
  redo,
  undo,
} from '../../core/editor/draft.ts';
import { type ApplyError, type EditOp, commit } from '../../core/editor/ops.ts';
import { asProject } from '../../core/editor/preview.ts';
import { readFile, readHead } from '../../core/github/index.ts';
import { parseSlug, routerBase } from '../../core/router.ts';
import type { Project } from '../../content/types.ts';
import type { Issue, RawContent } from '../../content/validate/index.ts';
import { EDITOR_CONTEXT } from './bundled.ts';
import { DraftStore, type StoreProblem } from './draft-store.ts';
import type { Bundled } from './snapshot.ts';
import { BEHIND_NOTICE, type Snapshot, assembleRaw, draftFrom, takeSnapshot } from './snapshot.ts';
import {
  dialogView,
  focusKeyOf,
  focusSelector,
  readEditing,
  sequenceOf,
  writeEditing,
} from './view.ts';

type LoadError = Extract<Snapshot, { kind: 'failed' }>['error'];

/** Runs after every render, router-driven or the layer's own, to decorate the dialog. */
export type Decorator = (modal: HTMLDialogElement, layer: EditLayer) => void;

export class EditLayer extends EventTarget {
  session: AdminSession;
  readonly store: DraftStore;
  readonly host: ProjectDialog;
  readonly modal: HTMLDialogElement;
  readonly bundled: Bundled;
  readonly #sequence: readonly Project[];
  /** Text for the toolbar: behind-the-repo notice, storage warnings, load failures. */
  notice: string | null = null;
  /** Repo-file issues when the open project is read-only (FR-384). */
  readOnly: readonly Issue[] | null = null;
  loadError: LoadError | null = null;
  /** Set while a publish is in flight: `beforeunload` warns (FR-385). */
  busy = false;
  /** False while the size × media pair is invalid and the last valid version is shown (FR-382). */
  previewValid = true;
  readonly #histories = new Map<string, History>();
  readonly #raw = new Map<string, RawContent>();
  readonly #lastValid = new Map<string, Project>();
  readonly #decorators: Decorator[] = [];
  /** The island and the panel: inside the open dialog, re-appended after each render. */
  readonly #kept = new Set<HTMLElement>();
  readonly #observer: MutationObserver;
  #slug: string | null = null;
  #editing = readEditing();

  constructor(
    session: AdminSession,
    store: DraftStore,
    host: ProjectDialog,
    modal: HTMLDialogElement,
    bundled: Bundled,
  ) {
    super();
    this.bundled = bundled;
    this.#sequence = sequenceOf(bundled.projects);
    this.session = session;
    this.store = store;
    this.host = host;
    this.modal = modal;
    this.#observer = new MutationObserver((records) => {
      // Moving the island or the panel in and out isn't a render.
      const moved = (n: Node): boolean => this.#isKept(n);
      const real = records.some(
        (r) =>
          r.type === 'attributes' || [...r.addedNodes, ...r.removedNodes].some((n) => !moved(n)),
      );
      if (real) this.sync();
    });
    // The island (admin-auth FR-354) is kept by reference: show() detaches it, and a detached
    // node can't be found by id.
    const island = document.getElementById('admin-island');
    if (island !== null) this.#kept.add(island);
    this.#observer.observe(modal, { childList: true, attributes: true, attributeFilter: ['open'] });
    document.documentElement.dataset['adminEdit'] = this.#editing ? 'on' : 'off';
    addEventListener('beforeunload', this.#onBeforeUnload);
  }

  get slug(): string | null {
    return this.#slug;
  }
  get history(): History | null {
    return this.#slug === null ? null : (this.#histories.get(this.#slug) ?? null);
  }
  get draft(): Draft | null {
    return this.history?.draft ?? null;
  }
  get raw(): RawContent | null {
    return this.#slug === null ? null : (this.#raw.get(this.#slug) ?? null);
  }
  get changes(): number {
    const draft = this.draft;
    return draft === null ? 0 : changeCount(draft);
  }
  get canUndo(): boolean {
    const h = this.history;
    return h !== null && canUndo(h);
  }
  get canRedo(): boolean {
    const h = this.history;
    return h !== null && canRedo(h);
  }

  get editing(): boolean {
    return this.#editing;
  }
  /** Edit mode (FR-382). Off, the dialog still renders the draft: a clean preview. */
  set editing(on: boolean) {
    this.#editing = on;
    writeEditing(on);
    // Off renders the clean preview; on decorates it again (FR-382).
    if (this.draft !== null && this.modal.open) this.render();
    else this.#decorate();
    this.#changed();
  }

  onDecorate(decorator: Decorator): void {
    this.#decorators.push(decorator);
  }

  /** Keeps `node` inside the open dialog across renders, and in <body> while it's closed. */
  keepInDialog(node: HTMLElement): void {
    this.#kept.add(node);
    this.#reattach();
  }

  /** Applies an op. Structural ops re-render; text ops don't, the span already shows the text. */
  dispatch(op: EditOp, group: string | null = null): ApplyError | null {
    const h = this.history;
    if (h === null || this.readOnly !== null) return null;
    const result = commit(h, op, group);
    if (!result.ok) return result.reason;
    this.#setHistory(result.draft, op.kind !== 'text');
    return null;
  }

  endGroup(): void {
    const h = this.history;
    if (h !== null) this.#histories.set(h.draft.slug, endGroup(h));
  }
  undo(): void {
    const h = this.history;
    if (h !== null) this.#setHistory(undo(h), true);
  }
  redo(): void {
    const h = this.history;
    if (h !== null) this.#setHistory(redo(h), true);
  }

  /** Replaces the open project's draft (Discard, reload, publish), then renders. `show` opens
   * the dialog for a draft the router can't (a create, FR-393). */
  replaceDraft(draft: Draft, raw: RawContent | null = null, show = false): void {
    this.#slug = draft.slug;
    if (raw !== null) this.#raw.set(draft.slug, raw);
    this.#setHistory(begin(draft), true, show);
  }

  #setHistory(h: History, rerender: boolean, show = false): void {
    this.#histories.set(h.draft.slug, h);
    // A clean draft isn't kept: nothing to restore, and no "Local drafts" entry (FR-385).
    if (changeCount(h.draft) === 0) void this.store.clear(h.draft.slug);
    else this.store.save(h.draft);
    if (rerender) this.render(show);
    this.#changed();
  }

  #changed(): void {
    this.dispatchEvent(new Event('change'));
  }

  /** Renders the draft into the real dialog and puts focus back where it was (FR-381). */
  render(show = false): void {
    const draft = this.draft;
    if (draft === null || (!this.modal.open && !show)) return;
    const valid = asProject(draft.working);
    this.previewValid = valid !== null;
    if (valid !== null) this.#lastValid.set(draft.slug, valid);
    const project = valid ?? this.#lastValid.get(draft.slug);
    if (project === undefined) return;
    const active = document.activeElement;
    const kept = active instanceof HTMLElement && this.#isKept(active) ? active : null;
    const key = this.focusNext ?? (active instanceof HTMLElement ? focusKeyOf(active) : null);
    this.focusNext = null;
    this.host.show(dialogView(project, this.#sequence));
    this.#reattach();
    this.#decorate();
    this.#observer.takeRecords();
    if (kept?.isConnected) kept.focus();
    else if (key !== null) this.modal.querySelector<HTMLElement>(focusSelector(key))?.focus();
  }

  /** A focus key (`data-focus-key` or `data-pointer`) to focus after the next render. */
  focusNext: string | null = null;

  #isKept(node: Node): boolean {
    return [...this.#kept].some((k) => k.contains(node));
  }

  /** The island and kept elements sit inside the open modal, else in <body> (FR-381). */
  #reattach(): void {
    const target = this.modal.open ? this.modal : document.body;
    for (const node of this.#kept) {
      if (node.parentElement !== target) target.append(node);
    }
  }

  #decorate(): void {
    if (!this.modal.open) return;
    for (const decorator of this.#decorators) decorator(this.modal, this);
  }

  /** The router called show() or hide(): follow it (FR-381). */
  sync(): void {
    this.#reattach();
    if (!this.modal.open) {
      this.#slug = null;
      this.#changed();
      return;
    }
    const base = routerBase(location.pathname);
    const slug = parseSlug(location.pathname.slice(base.length) || '/');
    if (slug === null) return;
    if (slug === this.#slug && this.#histories.has(slug)) {
      this.render();
      return;
    }
    this.#slug = slug;
    this.#decorate();
    void this.open(slug);
  }

  /** The open project's draft: memory, then IndexedDB, then a fresh snapshot (FR-384, FR-385). */
  async open(slug: string): Promise<void> {
    this.notice = null;
    this.readOnly = null;
    this.loadError = null;
    if (!this.#histories.has(slug)) {
      const stored = await this.store.load(slug);
      if (stored !== null) {
        this.#histories.set(slug, begin(stored));
        this.#raw.set(slug, assembleRaw(slug, stored.base.files, this.bundled));
      } else {
        await this.#snapshot(slug);
      }
    }
    if (this.#slug !== slug) return;
    this.render();
    this.#changed();
  }

  async #snapshot(slug: string): Promise<void> {
    const ctx = validationContext(EDITOR_CONTEXT, []);
    const snap = await takeSnapshot(this.session, slug, this.bundled, ctx, { readHead, readFile });
    if (snap.kind === 'failed') {
      this.loadError = snap.error;
      return;
    }
    this.notice = snap.behind ? BEHIND_NOTICE : null;
    this.readOnly = snap.invalid;
    this.#raw.set(slug, snap.raw);
    const draft = draftFrom(slug, snap);
    if (draft !== null) this.#histories.set(slug, begin(draft));
  }

  /** Storage problems become toolbar copy (FR-385). */
  storeProblem(problem: StoreProblem): void {
    this.notice =
      problem === 'fallback'
        ? "Drafts won't survive a reload here."
        : 'Another tab saved a newer copy of this draft. Reload to see it.';
    this.#changed();
  }

  /** Warns before leaving while drafts live in memory only, or a publish is in flight. */
  readonly #onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (this.busy || (!this.store.persistent && this.changes > 0)) event.preventDefault();
  };
}
