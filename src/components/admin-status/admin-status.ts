import { RECOMMENDED_EXPIRY_DAYS } from '../../core/auth/config.ts';
import type { AuthProvider } from '../../core/auth/provider.ts';
import {
  announceSignedIn,
  type AdminSession,
  type SignOutReason,
} from '../../core/auth/session.ts';
import { defineOnce, el } from '../../core/dom.ts';
import { AdminSignIn, define as defineSignIn } from '../admin-sign-in/admin-sign-in.ts';
import './admin-status.css';

const DATE = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

export function expiryText(expiresAt: Date | null): string {
  return expiresAt
    ? `Token expires ${DATE.format(expiresAt)}.`
    : `Tokens expire on the date you chose (${String(RECOMMENDED_EXPIRY_DAYS)} days recommended).`;
}

/**
 * <admin-status>: "Signed in as {login}", the expiry, Sign out, and the re-auth dialog after a
 * 401 (spec 004 admin-auth FR-352–FR-354). It assumes nothing about where it sits: edit-layer
 * may move the island into an open modal, so listeners follow connect and disconnect.
 */
export class AdminStatus extends HTMLElement {
  session: AdminSession | null = null;
  provider: AuthProvider | undefined;
  /** FR-353: a full load drops every in-memory reference. Replaceable in tests. */
  navigate: (url: string) => void = (url) => {
    location.assign(url);
  };

  private readonly text = el('p', { class: 'ast__text', role: 'status' });
  private readonly expiry = el('p', { class: 'ast__expiry' });
  private readonly again = el('button', { type: 'button', class: 'ast__btn', hidden: true }, [
    'Sign in again',
  ]);
  private readonly signOut = el('button', { type: 'button', class: 'ast__btn' }, ['Sign out']);
  private reauth: AdminSignIn | undefined;

  connectedCallback(): void {
    if (!this.firstChild) {
      this.append(
        el('div', { class: 'ast__info' }, [this.text, this.expiry]),
        el('div', { class: 'ast__actions' }, [this.again, this.signOut]),
      );
      this.addEventListener('click', this.onClick);
    }
    document.addEventListener('admin:signed-in', this.onSignedIn);
    document.addEventListener('admin:signed-out', this.onSignedOut);
    this.render();
  }

  disconnectedCallback(): void {
    document.removeEventListener('admin:signed-in', this.onSignedIn);
    document.removeEventListener('admin:signed-out', this.onSignedOut);
  }

  /** Opens the modal re-auth form (FR-352). */
  openReauth(): void {
    const provider = this.provider;
    if (!provider) return;
    if (!this.reauth) {
      defineSignIn();
      const form = new AdminSignIn();
      form.mode = 'dialog';
      form.signIn = (input) => provider.signIn(input);
      form.persistent = provider.persistent;
      form.addEventListener('admin-sign-in:success', (event) => {
        announceSignedIn(event.detail);
      });
      form.addEventListener('admin-sign-in:dismiss', () => {
        if (this.again.isConnected && !this.again.hidden) this.again.focus();
      });
      this.reauth = form;
      this.append(form);
    }
    this.reauth.open();
  }

  private render(): void {
    const session = this.session;
    this.again.hidden = session !== null;
    if (session) {
      this.text.textContent = `Signed in as ${session.login}`;
      const reload =
        this.provider?.persistent === false ? ' Paste the token again after a reload.' : '';
      this.expiry.textContent = expiryText(session.expiresAt) + reload;
    } else {
      this.text.textContent = 'Signed out: GitHub stopped accepting the token.';
      this.expiry.textContent = 'Sign in again to keep editing.';
    }
  }

  private readonly onSignedIn = (event: CustomEvent<AdminSession>): void => {
    this.session = event.detail;
    this.render();
  };

  private readonly onSignedOut = (event: CustomEvent<{ readonly reason: SignOutReason }>): void => {
    if (event.detail.reason !== 'unauthorized') return;
    this.session = null;
    this.render();
    this.openReauth();
  };

  private readonly onClick = (event: MouseEvent): void => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (button === this.again) this.openReauth();
    if (button === this.signOut) {
      this.provider?.signOut();
      this.navigate('/admin');
    }
  };
}

export function define(): void {
  defineOnce('admin-status', AdminStatus);
}

/**
 * `<aside id="admin-island">` with the status and the empty toolbar slot edit-layer fills
 * (FR-354). Its height is published as `--admin-island-h` so the page reserves scroll padding
 * and focus never hides under it (SC 2.4.11, FR-357).
 */
export function buildIsland(status: AdminStatus): HTMLElement {
  const island = el('aside', { id: 'admin-island', class: 'admin-island', 'aria-label': 'Admin' }, [
    status,
    el('div', { class: 'admin-island__toolbar', 'data-admin-slot': 'toolbar' }),
  ]);
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        '--admin-island-h',
        `${String(Math.ceil(island.getBoundingClientRect().height))}px`,
      );
    }).observe(island);
  }
  return island;
}
