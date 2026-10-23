import { defineOnce, el } from '../../core/dom.ts';
import { buildBar, buildBody, buildHero, type DialogView } from './dialog-content.ts';
import './project-dialog.css';

export type { DialogView } from './dialog-content.ts';

declare global {
  interface HTMLElementEventMap {
    'project-dialog:close': CustomEvent<null>;
    'project-dialog:navigate': CustomEvent<{ readonly direction: -1 | 1 }>;
  }
}

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'IFRAME', 'VIDEO'].includes(target.tagName));

/**
 * <project-dialog>: full-screen native modal (FR-050–FR-055). It renders a view and reports
 * intent ('close', 'navigate'); the router decides what happens next.
 */
export class ProjectDialog extends HTMLElement {
  private readonly dialog = el('dialog', { class: 'pd', 'aria-labelledby': 'pd-title' });
  private heroElement: HTMLElement | undefined;

  connectedCallback(): void {
    if (this.dialog.isConnected) return;
    this.append(this.dialog);
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.requestClose();
    });
    this.dialog.addEventListener('click', this.onClick);
    this.dialog.addEventListener('keydown', this.onKeydown);
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  get hero(): HTMLElement | undefined {
    return this.heroElement;
  }

  show(view: DialogView): void {
    const hero = buildHero(view.project);
    const { body, title } = buildBody(view, hero);
    this.heroElement = hero;
    this.dialog.replaceChildren(buildBar(view), body);
    if (!this.dialog.open) this.dialog.showModal();
    title.focus();
  }

  hide(): void {
    if (this.dialog.open) this.dialog.close();
    this.dialog.replaceChildren();
    this.heroElement = undefined;
  }

  private requestClose(): void {
    this.dispatchEvent(new CustomEvent('project-dialog:close', { detail: null, bubbles: true }));
  }

  private navigate(direction: -1 | 1): void {
    this.dispatchEvent(
      new CustomEvent('project-dialog:navigate', { detail: { direction }, bubbles: true }),
    );
  }

  private readonly onClick = (event: MouseEvent): void => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || button.disabled) return;
    if (button.hasAttribute('data-close')) this.requestClose();
    const dir = button.dataset['dir'];
    if (dir === '-1' || dir === '1') this.navigate(dir === '-1' ? -1 : 1);
  };

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const button = this.dialog.querySelector<HTMLButtonElement>(
      `.pd__btn[data-dir="${direction}"]`,
    );
    if (!button || button.disabled) return;
    event.preventDefault();
    this.navigate(direction);
  };
}

export function define(): void {
  defineOnce('project-dialog', ProjectDialog);
}
