import { describe, expect, it } from 'vitest';
import {
  AdminStatus,
  buildIsland,
  define,
} from '../../src/components/admin-status/admin-status.ts';
import type { AuthProvider } from '../../src/core/auth/provider.ts';
import type { AdminSession } from '../../src/core/auth/session.ts';

const session = (login: string): AdminSession => ({
  login,
  repo: { owner: 'ericthayer', name: 'ethayer-design-timeline', branch: 'main' },
  expiresAt: null,
  authorizedFetch: () => Promise.reject(new Error('unused')),
});

function mount(): { status: AdminStatus; island: HTMLElement; log: string[] } {
  define();
  const log: string[] = [];
  const provider: AuthProvider = {
    restore: () => Promise.resolve(null),
    signIn: () => Promise.resolve({ ok: true, session: session('ericthayer') }),
    signOut: () => log.push('signOut'),
    persistent: true,
  };
  const status = new AdminStatus();
  status.session = session('ericthayer');
  status.provider = provider;
  status.navigate = (url) => log.push(`navigate:${url}`);
  const island = buildIsland(status);
  document.body.append(island);
  return { status, island, log };
}

describe('<admin-status> and the island (spec 004 FR-352–FR-354)', () => {
  it('builds the labeled island with the status and an empty toolbar slot', () => {
    const { island } = mount();
    expect(island.id).toBe('admin-island');
    expect(island.tagName).toBe('ASIDE');
    expect(island.getAttribute('aria-label')).toBe('Admin');
    const slot = island.querySelector('[data-admin-slot="toolbar"]');
    expect(slot?.childElementCount).toBe(0);
    expect(island.textContent).toContain('Signed in as ericthayer');
    expect(island.textContent).toContain('30 days recommended');
    island.remove();
  });

  it('signs out and reloads /admin', () => {
    const { island, log } = mount();
    const button = [...island.querySelectorAll('button')].find((b) => b.textContent === 'Sign out');
    button?.click();
    expect(log).toEqual(['signOut', 'navigate:/admin']);
    island.remove();
  });

  it('still reacts to session events after being re-parented', () => {
    const { status, island } = mount();
    const elsewhere = document.createElement('div');
    document.body.append(elsewhere);
    elsewhere.append(island);

    document.dispatchEvent(
      new CustomEvent('admin:signed-out', { detail: { reason: 'unauthorized' } }),
    );
    expect(status.textContent).toContain('GitHub stopped accepting the token');
    const again = [...status.querySelectorAll('button')].find(
      (b) => b.textContent === 'Sign in again',
    );
    expect(again?.hidden).toBe(false);
    expect(status.querySelector('admin-sign-in dialog h2')?.textContent).toBe('Sign in again');

    document.dispatchEvent(new CustomEvent('admin:signed-in', { detail: session('EricThayer') }));
    expect(status.textContent).toContain('Signed in as EricThayer');
    expect(again?.hidden).toBe(true);
    elsewhere.remove();
  });
});
