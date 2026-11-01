// Wires <admin-toolbar> to the layer (spec 004 edit-layer FR-383, FR-395, FR-396): state in,
// actions out, and Undo/Redo shortcuts while focus isn't in a text field.
import {
  AdminToolbar,
  type ToolbarAction,
  define as defineToolbar,
} from '../../components/admin-toolbar/admin-toolbar.ts';
import { countIssues } from '../../core/editor/issues.ts';
import { type JobStatus, type ToolbarState } from '../../core/editor/toolbar.ts';
import type { Issue } from '../../content/validate/index.ts';
import type { EditLayer } from './edit-layer.ts';
import type { Validation } from './validation.ts';

declare global {
  interface HTMLElementEventMap {
    /** A toolbar action the toolbar itself doesn't handle: settings, new, discard, publish. */
    'editor:action': CustomEvent<ToolbarAction>;
    /** "Go to field" for an issue no inline field holds: the panel opens the right section. */
    'editor:go-to': CustomEvent<Issue>;
  }
}

const isTextField = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export class ToolbarController {
  readonly toolbar: AdminToolbar;
  job: JobStatus = { kind: 'none' };
  panelOpen = false;
  liveUrl: string | null = null;
  readonly #layer: EditLayer;
  readonly #validation: Validation;
  #drafts: readonly string[] = [];

  constructor(layer: EditLayer, validation: Validation) {
    defineToolbar();
    this.toolbar = new AdminToolbar();
    this.#layer = layer;
    this.#validation = validation;
    document.querySelector('[data-admin-slot="toolbar"]')?.append(this.toolbar);
    layer.addEventListener('change', () => {
      this.update();
      void this.#refreshDrafts();
    });
    validation.addEventListener('validated', () => {
      this.update();
    });
    this.toolbar.addEventListener('admin-toolbar:action', (event) => {
      this.#act(event.detail);
    });
    document.addEventListener('keydown', this.#onKeydown);
    void this.#refreshDrafts();
    this.update();
  }

  get issues(): readonly Issue[] {
    return this.#validation.built?.issues ?? this.#layer.readOnly ?? [];
  }

  state(): ToolbarState {
    const layer = this.#layer;
    const issues = this.issues;
    return {
      editing: layer.editing,
      slug: layer.slug,
      draft: { changes: layer.changes, ...countIssues(issues) },
      job: this.job,
      issues,
      canUndo: layer.canUndo,
      canRedo: layer.canRedo,
      readOnly: layer.readOnly !== null,
      panelOpen: this.panelOpen,
      localDrafts: this.#drafts,
      notice: layer.notice,
      liveUrl: this.liveUrl,
    };
  }

  update(): void {
    const state = this.state();
    this.toolbar.state = state;
    this.toolbar.alert(this.#layer.notice ?? '');
  }

  async #refreshDrafts(): Promise<void> {
    this.#drafts = await this.#layer.store.slugs();
    this.update();
  }

  #act(action: ToolbarAction): void {
    const layer = this.#layer;
    switch (action.kind) {
      case 'edit':
        layer.editing = !layer.editing;
        return;
      case 'undo':
        layer.undo();
        return;
      case 'redo':
        layer.redo();
        return;
      case 'issues':
        this.toolbar.issuesOpen = !this.toolbar.issuesOpen;
        return;
      case 'go-to-field':
        this.#goTo(action.index);
        return;
      default:
        layer.modal.dispatchEvent(new CustomEvent('editor:action', { detail: action }));
    }
  }

  /** Focuses the issue's inline field, or asks the panel for its section (FR-395). */
  #goTo(index: number): void {
    const issue = this.issues[index];
    if (issue === undefined) return;
    const field = this.#layer.modal.querySelector<HTMLElement>(
      `[data-pointer="${CSS.escape(issue.path)}"]`,
    );
    if (field) field.focus();
    else this.#layer.modal.dispatchEvent(new CustomEvent('editor:go-to', { detail: issue }));
  }

  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'z')
      return;
    if (isTextField(event.target) || this.#layer.slug === null) return;
    event.preventDefault();
    if (event.shiftKey) this.#layer.redo();
    else this.#layer.undo();
  };
}
