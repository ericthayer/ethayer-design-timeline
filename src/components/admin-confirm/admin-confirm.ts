import { defineOnce, el } from '../../core/dom.ts';
import type { ConfirmBlock, ConfirmResult, ConfirmSpec } from '../../core/editor/confirm.ts';
import './admin-confirm.css';

const HEADING_ID = 'adc-h';
const TYPED_ID = 'adc-typed';
const GATE_ID = 'adc-gate';

function block(b: ConfirmBlock): HTMLElement {
  if (b.kind === 'p') return el('p', { class: 'adc__text' }, [b.text]);
  return el(
    'ul',
    { class: 'adc__list' },
    b.items.map((item) => el('li', {}, [item])),
  );
}

/**
 * <admin-confirm>: the editor's native modal dialog for warnings, Discard, conflict, and Delete
 * (spec 004 edit-layer FR-394, FR-395, FR-397, FR-399). `ask(spec)` shows it and resolves with
 * the chosen action, or `cancel` for Cancel and Esc. Focus returns to the opener on close.
 */
export class AdminConfirm extends HTMLElement {
  private readonly dialog = el('dialog', { class: 'adc', 'aria-labelledby': HEADING_ID });
  private settle: ((value: string) => void) | null = null;
  private opener: HTMLElement | null = null;

  connectedCallback(): void {
    if (this.dialog.isConnected) return;
    this.dialog.addEventListener('close', this.onClose);
    // Esc closes this dialog only: nothing under it sees the key.
    this.dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') event.stopPropagation();
    });
    this.append(this.dialog);
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  /** Shows `spec`. A dialog already open is cancelled first. */
  ask<V extends string>(spec: ConfirmSpec<V>): Promise<ConfirmResult<V>> {
    if (this.dialog.open) this.dialog.close('cancel');
    const active = document.activeElement;
    this.opener = active instanceof HTMLElement ? active : null;
    this.dialog.replaceChildren(...this.content(spec));
    this.dialog.returnValue = '';
    return new Promise((resolve) => {
      this.settle = (value) => {
        const action = spec.actions.find((a) => a.value === value);
        resolve(action ? action.value : 'cancel');
      };
      this.dialog.showModal();
      this.dialog.querySelector<HTMLElement>('[autofocus]')?.focus();
    });
  }

  private content<V extends string>(spec: ConfirmSpec<V>): HTMLElement[] {
    const typed = spec.typeToConfirm;
    const input =
      typed === undefined
        ? null
        : el('input', {
            id: TYPED_ID,
            class: 'adc__input',
            type: 'text',
            autocomplete: 'off',
            autocapitalize: 'off',
            spellcheck: 'false',
            autofocus: true,
          });
    const cancel = el('button', { type: 'button', class: 'adc__btn', autofocus: input === null }, [
      spec.cancelLabel,
    ]);
    cancel.addEventListener('click', () => {
      this.dialog.close('cancel');
    });
    const gate = input === null ? null : el('p', { id: GATE_ID, class: 'adc__hint' });
    const buttons = spec.actions.map((action) => {
      const button = el(
        'button',
        {
          type: 'button',
          class: action.primary === true ? 'adc__btn adc__btn--primary' : 'adc__btn',
        },
        [action.label],
      );
      const gated = action.primary === true && input !== null && typed !== undefined;
      const sync = (): void => {
        const locked = gated && input.value.trim() !== typed;
        if (locked) button.setAttribute('aria-disabled', 'true');
        else button.removeAttribute('aria-disabled');
        if (gated && gate !== null) {
          gate.textContent = locked ? `Type ${typed} to enable ${action.label}.` : '';
          button.setAttribute('aria-describedby', GATE_ID);
        }
      };
      if (gated) {
        input.addEventListener('input', sync);
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' && button.getAttribute('aria-disabled') !== 'true') {
            event.preventDefault();
            this.dialog.close(action.value);
          }
        });
      }
      sync();
      button.addEventListener('click', () => {
        if (button.getAttribute('aria-disabled') !== 'true') this.dialog.close(action.value);
      });
      return button;
    });
    return [
      el('h2', { id: HEADING_ID, class: 'adc__heading' }, [spec.heading]),
      ...spec.blocks.map(block),
      ...(input === null || typed === undefined
        ? []
        : [
            el('label', { class: 'adc__field', for: TYPED_ID }, [
              el('span', { class: 'adc__label' }, [`Type ${typed} to confirm`]),
              input,
            ]),
          ]),
      ...(gate === null ? [] : [gate]),
      el('div', { class: 'adc__actions' }, [cancel, ...buttons]),
    ];
  }

  private readonly onClose = (): void => {
    const settle = this.settle;
    this.settle = null;
    settle?.(this.dialog.returnValue);
    const opener = this.opener;
    this.opener = null;
    if (opener?.isConnected) opener.focus();
  };
}

/** The page's one confirm dialog, created and connected on first use. */
export function confirmDialog(): AdminConfirm {
  define();
  const found = document.querySelector('admin-confirm');
  if (found instanceof AdminConfirm) return found;
  const created = new AdminConfirm();
  document.body.append(created);
  return created;
}

export function define(): void {
  defineOnce('admin-confirm', AdminConfirm);
}
