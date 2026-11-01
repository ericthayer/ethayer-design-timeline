import { CATEGORIES } from '../../content/categories.ts';
import type { Era } from '../../content/types.ts';
import { defineOnce, el } from '../../core/dom.ts';
import type { CreateFields } from '../../core/editor/create.ts';
import '../admin-confirm/admin-confirm.css';
import './admin-create.css';

declare global {
  interface HTMLElementEventMap {
    'admin-create:submit': CustomEvent<CreateFields>;
  }
}

const HEADING_ID = 'adn-h';

interface Field {
  readonly input: HTMLInputElement | HTMLSelectElement;
  readonly error: HTMLElement;
}

/**
 * <admin-create>: the New project form, a native modal dialog (spec 004 edit-layer FR-393,
 * FR-399). The slug is checked on input against `checkSlug`; Create reports the fields and the
 * layer opens the preview. Esc and Cancel close it, and focus returns to the opener.
 */
export class AdminCreate extends HTMLElement {
  /** Why a slug can't be used, or null (FR-393). */
  checkSlug: (slug: string) => string | null = () => null;
  eras: readonly Era[] = [];
  private readonly dialog = el('dialog', { class: 'adc adn', 'aria-labelledby': HEADING_ID });
  private readonly form = el('form', { class: 'adn__form', method: 'dialog', novalidate: true });
  private opener: HTMLElement | null = null;
  private readonly fields = new Map<string, Field>();

  connectedCallback(): void {
    if (this.dialog.isConnected) return;
    this.dialog.addEventListener('close', () => {
      const opener = this.opener;
      this.opener = null;
      if (opener?.isConnected) opener.focus();
    });
    this.dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') event.stopPropagation();
    });
    this.form.addEventListener('submit', this.onSubmit);
    this.form.addEventListener('input', (event) => {
      if (event.target === this.fields.get('slug')?.input) this.validate('slug');
    });
    this.dialog.append(this.form);
    this.append(this.dialog);
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  open(): void {
    const active = document.activeElement;
    this.opener = active instanceof HTMLElement ? active : null;
    this.build();
    this.dialog.showModal();
    this.fields.get('slug')?.input.focus();
  }

  private field(
    key: string,
    label: string,
    input: HTMLInputElement | HTMLSelectElement,
    hint = '',
  ): HTMLElement {
    const id = `adn-${key}`;
    input.id = id;
    input.classList.add('adc__input');
    const error = el('span', { id: `${id}-error`, class: 'adn__error' });
    const describedBy = [hint === '' ? '' : `${id}-hint`, error.id].filter(Boolean).join(' ');
    input.setAttribute('aria-describedby', describedBy);
    this.fields.set(key, { input, error });
    return el('div', { class: 'adc__field' }, [
      el('label', { class: 'adc__label', for: id }, [label]),
      ...(hint === '' ? [] : [el('span', { id: `${id}-hint`, class: 'adc__hint' }, [hint])]),
      input,
      error,
    ]);
  }

  private build(): void {
    this.fields.clear();
    const text = (): HTMLInputElement =>
      el('input', { type: 'text', autocomplete: 'off', spellcheck: 'false' });
    const mono = (input: HTMLInputElement): HTMLInputElement => {
      input.classList.add('adc__input--mono');
      return input;
    };
    const era = el('select');
    for (const e of this.eras) era.append(el('option', { value: e.id }, [e.label]));
    const category = el('select');
    for (const c of CATEGORIES) category.append(el('option', { value: c.id }, [c.label]));
    const cancel = el('button', { type: 'button', class: 'adc__btn' }, ['Cancel']);
    cancel.addEventListener('click', () => {
      this.dialog.close();
    });
    this.form.replaceChildren(
      el('h2', { id: HEADING_ID, class: 'adc__heading' }, ['New project']),
      this.field('slug', 'Slug', mono(text()), 'Its URL: lowercase words joined by hyphens.'),
      this.field('title', 'Title', text()),
      this.field('era', 'Era', era, 'The engagement comes from the era.'),
      this.field('category', 'Category', category, 'Its section on Projects.'),
      this.field('client', 'Client', text()),
      this.field('role', 'Role', text()),
      el('div', { class: 'adc__actions' }, [
        cancel,
        el('button', { type: 'submit', class: 'adc__btn adc__btn--primary' }, ['Create']),
      ]),
    );
  }

  private value(key: string): string {
    return this.fields.get(key)?.input.value.trim() ?? '';
  }

  /** Shows the field's problem, if any; returns true when it's fine. */
  private validate(key: 'slug' | 'title'): boolean {
    const field = this.fields.get(key);
    if (!field) return false;
    const problem =
      key === 'slug'
        ? this.checkSlug(this.value('slug'))
        : this.value('title') === ''
          ? 'Enter a title.'
          : null;
    field.error.textContent = problem ?? '';
    if (problem === null) field.input.removeAttribute('aria-invalid');
    else field.input.setAttribute('aria-invalid', 'true');
    return problem === null;
  }

  private readonly onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const slugOk = this.validate('slug');
    const titleOk = this.validate('title');
    if (!slugOk || !titleOk) {
      this.fields.get(slugOk ? 'title' : 'slug')?.input.focus();
      return;
    }
    const era = this.eras.find((e) => e.id === this.value('era'));
    const category = CATEGORIES.find((c) => c.id === this.value('category'));
    if (!era || !category) return;
    const detail: CreateFields = {
      slug: this.value('slug'),
      title: this.value('title'),
      era,
      category: category.id,
      client: this.value('client'),
      role: this.value('role'),
    };
    // The preview takes focus, not the opener.
    this.opener = null;
    this.dialog.close();
    this.dispatchEvent(new CustomEvent('admin-create:submit', { detail, bubbles: true }));
  };
}

export function define(): void {
  defineOnce('admin-create', AdminCreate);
}
