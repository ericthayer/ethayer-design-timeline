import type { Issue } from '../../content/validate/index.ts';
import { defineOnce, el } from '../../core/dom.ts';
import { placeIssues } from '../../core/editor/issues.ts';
import { type PanelContext, card, danger, identity, notice, order } from './panel-fields.ts';
import { links, metrics } from './panel-lists.ts';
import { cardMedia } from './panel-media.ts';
import { tileSection } from './panel-tile.ts';
import './admin-panel.css';

export type { PanelContext } from './panel-fields.ts';

declare global {
  interface HTMLElementEventMap {
    'admin-panel:close': CustomEvent<null>;
  }
}

const HEADING_ID = 'ed-panel-h';

/**
 * <admin-panel>: Card settings, a non-modal panel inside the project dialog (spec 004 edit-layer
 * FR-388–FR-390, FR-399). Opening focuses its heading; Close or Esc closes only the panel and
 * reports `admin-panel:close`, so the layer can return focus to the toggle. Every control has a
 * visible label and a focus key, so a rebuild after each change keeps focus where it was.
 */
export class AdminPanel extends HTMLElement {
  context: PanelContext | null = null;
  previewValid = true;
  /** The gallery tile whose settings show, or null. */
  tile: number | null = null;
  issues: readonly Issue[] = [];
  /** The repo path issues are matched against (the project file). */
  file = '';
  private readonly heading = el('h2', { id: HEADING_ID, class: 'edp__heading', tabindex: '-1' }, [
    'Card settings',
  ]);
  private readonly sections = el('div', { class: 'edp__sections' });

  connectedCallback(): void {
    if (this.firstChild) return;
    this.id = 'ed-panel';
    this.classList.add('ed-panel');
    this.setAttribute('role', 'complementary');
    this.setAttribute('aria-labelledby', HEADING_ID);
    if (!this.hasAttribute('data-open')) this.hidden = true;
    const close = el(
      'button',
      { type: 'button', class: 'edp__btn', 'data-focus-key': 'panel-close' },
      ['Close'],
    );
    close.addEventListener('click', () => {
      this.close();
    });
    this.append(el('div', { class: 'edp__head' }, [this.heading, close]), this.sections);
    this.addEventListener('keydown', this.onKeydown);
    this.render();
  }

  get isOpen(): boolean {
    return !this.hidden;
  }

  open(focus: 'heading' | 'none' = 'heading'): void {
    this.hidden = false;
    this.render();
    if (focus === 'heading') this.heading.focus();
  }

  close(): void {
    if (this.hidden) return;
    this.hidden = true;
    this.dispatchEvent(new CustomEvent('admin-panel:close', { detail: null, bubbles: true }));
  }

  /** Rebuilds the sections from the context; focus stays on the same control. */
  render(): void {
    const ctx = this.context;
    if (!this.firstChild) return;
    if (ctx === null || this.hidden) {
      this.sections.replaceChildren();
      return;
    }
    const active = document.activeElement;
    const key =
      active instanceof HTMLElement && this.contains(active)
        ? (active.dataset['focusKey'] ?? null)
        : null;
    const tile = this.tile === null ? null : tileSection(ctx, this.tile);
    this.sections.replaceChildren(
      ...(tile ? [tile] : []),
      cardMedia(ctx, this.previewValid),
      identity(ctx),
      card(ctx),
      order(ctx),
      links(ctx),
      metrics(ctx),
      notice(ctx),
      danger(ctx),
    );
    this.showErrors();
    if (key !== null)
      this.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(key)}"]`)?.focus();
  }

  /** Issues on panel controls: `aria-invalid` and a joined error after the control (FR-395). */
  showErrors(): void {
    for (const node of this.querySelectorAll('.ed-error')) node.remove();
    const controls = new Map<string, HTMLElement>();
    for (const node of this.querySelectorAll<HTMLElement>('[data-pointer]')) {
      node.removeAttribute('aria-invalid');
      node.removeAttribute('aria-describedby');
      const pointer = node.dataset['pointer'];
      if (pointer !== undefined && !controls.has(pointer)) controls.set(pointer, node);
    }
    const placed = placeIssues(this.issues, this.file, controls.keys());
    let n = 0;
    for (const [pointer, issues] of placed.byField) {
      const control = controls.get(pointer);
      if (!control) continue;
      n += 1;
      const id = `edp-error-${String(n)}`;
      const error = el('span', { id, class: 'ed-error' }, [issues.map((i) => i.message).join(' ')]);
      (control.closest('label') ?? control).after(error);
      const targets =
        control instanceof HTMLFieldSetElement ? [...control.querySelectorAll('input')] : [control];
      for (const target of targets) {
        target.setAttribute('aria-invalid', String(issues.some((i) => i.severity === 'error')));
        target.setAttribute('aria-describedby', id);
      }
    }
  }

  /** "Go to field" for an issue: opens the right section and focuses its control (FR-395). */
  goTo(issue: Issue): boolean {
    const tile = /^\/gallery\/(\d+)\//.exec(issue.path);
    this.tile = tile ? Number(tile[1]) : this.tile;
    this.open('none');
    const pointers = [...this.querySelectorAll<HTMLElement>('[data-pointer]')];
    const best = pointers
      .filter((node) => {
        const p = node.dataset['pointer'] ?? '';
        return p !== '' && (issue.path === p || issue.path.startsWith(`${p}/`));
      })
      .sort((a, b) => (b.dataset['pointer'] ?? '').length - (a.dataset['pointer'] ?? '').length)[0];
    const target = best instanceof HTMLFieldSetElement ? best.querySelector('input') : best;
    if (target) target.focus();
    else this.heading.focus();
    return target !== undefined && target !== null;
  }

  /** Esc closes only the panel, never the dialog (FR-388). */
  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
  };
}

export function define(): void {
  defineOnce('admin-panel', AdminPanel);
}
