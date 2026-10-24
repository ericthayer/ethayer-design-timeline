import {
  ALLOWED_LOGIN,
  RECOMMENDED_EXPIRY_DAYS,
  REPO,
  TOKEN_PREFIX,
  TOKEN_URL,
} from '../../core/auth/config.ts';
import { authMessage } from '../../core/auth/messages.ts';
import type { SignInOutcome } from '../../core/auth/provider.ts';
import type { AdminSession } from '../../core/auth/session.ts';
import type { AuthFailure } from '../../core/auth/verify.ts';
import { defineOnce, el } from '../../core/dom.ts';
import './admin-sign-in.css';

declare global {
  interface HTMLElementEventMap {
    'admin-sign-in:success': CustomEvent<AdminSession>;
    'admin-sign-in:dismiss': CustomEvent<null>;
  }
}

export type SignInMode = 'page' | 'dialog';

let instances = 0;

const strong = (text: string): HTMLElement => el('strong', {}, [text]);

function buildSteps(): HTMLOListElement {
  return el('ol', { class: 'asi__steps' }, [
    el('li', {}, [
      el('a', { href: TOKEN_URL, target: '_blank', rel: 'noopener noreferrer' }, [
        'Create a fine-grained token on GitHub',
        el('span', { class: 'visually-hidden' }, [' (opens in a new tab)']),
      ]),
      '.',
    ]),
    el('li', {}, ['Token name: ', strong('Timeline admin'), '.']),
    el('li', {}, ['Expiration: ', strong(`${RECOMMENDED_EXPIRY_DAYS} days`), ' (recommended).']),
    el('li', {}, ['Resource owner: ', strong(ALLOWED_LOGIN), '.']),
    el('li', {}, [
      'Repository access: ',
      strong('Only select repositories'),
      ' → ',
      strong(REPO.name),
      '.',
    ]),
    el('li', {}, [
      'Repository permissions: ',
      strong('Contents: Read and write'),
      ' and ',
      strong('Commit statuses: Read-only'),
      '. Metadata: Read-only is added automatically.',
    ]),
    el('li', {}, ['Generate the token, copy it, and paste it below.']),
  ]);
}

/**
 * <admin-sign-in>: paste-a-token form (spec 004 admin-auth FR-345, FR-357). Page mode sits in
 * <main> with an <h1>; dialog mode is the modal re-auth with an <h2>. It never keeps the token:
 * `signIn` gets the raw input and the field is cleared on success.
 */
export class AdminSignIn extends HTMLElement {
  mode: SignInMode = 'page';
  signIn: ((input: string) => Promise<SignInOutcome>) | undefined;
  /** False when the browser refuses sessionStorage (FR-349). */
  persistent = true;

  private readonly uid = `asi-${String(++instances)}`;
  private readonly input = el('input', {
    id: `${this.uid}-token`,
    class: 'asi__input',
    type: 'password',
    name: 'token',
    autocomplete: 'off',
    spellcheck: 'false',
    autocapitalize: 'off',
    'aria-describedby': `${this.uid}-hint`,
  });
  private readonly toggle = el(
    'button',
    {
      type: 'button',
      class: 'asi__toggle',
      'aria-pressed': 'false',
      'aria-controls': this.input.id,
    },
    ['Show token'],
  );
  private readonly error = el('p', { id: `${this.uid}-error`, class: 'asi__error', hidden: true });
  private readonly submit = el('button', { type: 'submit', class: 'asi__submit' }, ['Verify']);
  private readonly status = el('p', { class: 'asi__status', role: 'status' });
  private readonly dialog = el('dialog', {
    class: 'asi-dialog',
    'aria-labelledby': `${this.uid}-title`,
  });
  private busy = false;
  private succeeded = false;

  connectedCallback(): void {
    if (this.firstChild) return;
    const form = this.buildForm();
    if (this.mode === 'dialog') {
      this.dialog.append(form);
      this.dialog.addEventListener('close', this.onClose);
      this.append(this.dialog);
    } else {
      this.append(form);
    }
  }

  /** Dialog mode: open modally with focus on the field. */
  open(): void {
    this.succeeded = false;
    if (!this.dialog.open) this.dialog.showModal();
    this.input.focus();
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  /** Busy with a message (the restore check), or idle again with `null`. */
  setPending(message: string | null): void {
    this.setBusy(message !== null);
    this.status.textContent = message ?? '';
  }

  showError(failure: AuthFailure): void {
    this.error.textContent = authMessage(failure.kind, failure.retryAt);
    this.error.hidden = false;
    this.input.setAttribute('aria-invalid', 'true');
    this.input.setAttribute('aria-describedby', `${this.uid}-hint ${this.error.id}`);
    this.status.textContent = "Couldn't sign in.";
    this.input.focus();
  }

  focusField(): void {
    this.input.focus();
  }

  private buildForm(): HTMLFormElement {
    const page = this.mode === 'page';
    const heading = el(page ? 'h1' : 'h2', { id: `${this.uid}-title`, class: 'asi__title' }, [
      page ? 'Sign in to edit' : 'Sign in again',
    ]);
    const lede = page
      ? `Editing commits to GitHub, so this page needs a fine-grained token for ${REPO.name}. It stays in this tab and is erased when the tab closes.`
      : 'GitHub stopped accepting the token. Paste a new one to keep editing. Nothing on the page was lost.';
    const form = el('form', { class: 'asi', 'data-mode': this.mode, novalidate: true }, [
      heading,
      el('p', { class: 'asi__lede' }, [lede]),
      buildSteps(),
      el('div', { class: 'asi__field' }, [
        el('label', { class: 'asi__label', for: this.input.id }, ['GitHub token']),
        el('p', { id: `${this.uid}-hint`, class: 'asi__hint' }, [
          `Starts with ${TOKEN_PREFIX}. You can revoke it anytime in GitHub settings.`,
          ...(this.persistent ? [] : [" You'll need to paste the token again after a reload."]),
        ]),
        el('div', { class: 'asi__row' }, [this.input, this.toggle]),
        this.error,
      ]),
      el('div', { class: 'asi__actions' }, [
        this.submit,
        ...(page ? [] : [el('button', { type: 'button', class: 'asi__cancel' }, ['Not now'])]),
      ]),
      this.status,
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.verify();
    });
    form.addEventListener('click', this.onClick);
    return form;
  }

  private async verify(): Promise<void> {
    if (this.busy || !this.signIn) return;
    this.clearError();
    this.setPending('Checking with GitHub…');
    const outcome = await this.signIn(this.input.value);
    this.setBusy(false);
    if (!outcome.ok) {
      this.showError(outcome);
      return;
    }
    // FR-356: the token leaves the DOM as soon as it is verified.
    this.input.value = '';
    this.setShown(false);
    this.status.textContent = `Signed in as ${outcome.session.login}`;
    this.succeeded = true;
    if (this.dialog.open) this.dialog.close();
    this.dispatchEvent(
      new CustomEvent('admin-sign-in:success', { detail: outcome.session, bubbles: true }),
    );
  }

  private clearError(): void {
    this.error.hidden = true;
    this.error.textContent = '';
    this.input.removeAttribute('aria-invalid');
    this.input.setAttribute('aria-describedby', `${this.uid}-hint`);
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    // FR-357: stays focusable while busy; repeat submits are ignored above.
    this.submit.setAttribute('aria-disabled', String(busy));
  }

  private setShown(shown: boolean): void {
    this.input.type = shown ? 'text' : 'password';
    this.toggle.setAttribute('aria-pressed', String(shown));
  }

  private readonly onClick = (event: MouseEvent): void => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (button === this.toggle) this.setShown(this.input.type === 'password');
    if (button?.classList.contains('asi__cancel')) this.dialog.close();
  };

  private readonly onClose = (): void => {
    this.clearError();
    this.input.value = '';
    this.setShown(false);
    if (!this.succeeded) {
      this.dispatchEvent(new CustomEvent('admin-sign-in:dismiss', { detail: null, bubbles: true }));
    }
  };
}

export function define(): void {
  defineOnce('admin-sign-in', AdminSignIn);
}
