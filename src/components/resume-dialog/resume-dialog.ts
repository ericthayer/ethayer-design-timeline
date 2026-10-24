import type { Resume } from '../../content/types.ts';
import { defineOnce, el } from '../../core/dom.ts';
import { buildBar, buildDocument } from './resume-content.ts';
import './resume-dialog.css';

declare global {
  interface HTMLElementEventMap {
    'resume-dialog:close': CustomEvent<null>;
  }
}

/**
 * <resume-dialog>: the HTML résumé in a full-screen native modal (spec 002, FR-122–FR-125).
 * Like <project-dialog>, it reports 'close' and lets the router decide.
 */
export class ResumeDialog extends HTMLElement {
  resume: Resume | undefined;
  private readonly dialog = el('dialog', { class: 'rd', 'aria-labelledby': 'rd-title' });
  private heading: HTMLElement | undefined;

  connectedCallback(): void {
    if (this.dialog.isConnected) return;
    this.append(this.dialog);
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.requestClose();
    });
    this.dialog.addEventListener('click', this.onClick);
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  show(): void {
    if (!this.heading && this.resume) {
      const { body, title } = buildDocument(this.resume);
      this.heading = title;
      this.dialog.replaceChildren(buildBar(), body);
    }
    if (!this.dialog.open) this.dialog.showModal();
    this.heading?.focus();
  }

  hide(): void {
    this.dialog.querySelector('video')?.pause();
    if (this.dialog.open) this.dialog.close();
  }

  private requestClose(): void {
    this.dispatchEvent(new CustomEvent('resume-dialog:close', { detail: null, bubbles: true }));
  }

  private readonly onClick = (event: MouseEvent): void => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button) return;
    if (button.hasAttribute('data-close')) this.requestClose();
    if (button.hasAttribute('data-print')) print();
  };
}

export function define(): void {
  defineOnce('resume-dialog', ResumeDialog);
}
