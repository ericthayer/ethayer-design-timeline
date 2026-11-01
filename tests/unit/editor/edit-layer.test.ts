// The edit layer drives the real <project-dialog> (spec 004 edit-layer FR-381, FR-382, T385).
// happy-dom stands in for the browser; the e2e suite (T393) covers the router and Prev/Next.
import { beforeEach, describe, expect, it } from 'vitest';
import { DraftStore, memoryBackend } from '../../../src/admin/edit/draft-store.ts';
import { EditLayer } from '../../../src/admin/edit/edit-layer.ts';
import { dialogView } from '../../../src/admin/edit/view.ts';
import {
  ProjectDialog,
  define as defineDialog,
} from '../../../src/components/project-dialog/project-dialog.ts';
import { define as defineArtwork } from '../../../src/components/swiss-artwork/swiss-artwork.ts';
import type { AdminSession } from '../../../src/core/auth/session.ts';
import { asProject } from '../../../src/core/editor/preview.ts';
import { demoDraft, demoProject } from './fixtures.ts';

const session: AdminSession = {
  login: 'ericthayer',
  repo: { owner: 'o', name: 'r', branch: 'main' },
  expiresAt: null,
  authorizedFetch: () => Promise.reject(new Error('not used')),
};

function setup(): { layer: EditLayer; modal: HTMLDialogElement; island: HTMLElement } {
  document.body.replaceChildren();
  defineArtwork();
  defineDialog();
  const island = document.createElement('aside');
  island.id = 'admin-island';
  const button = document.createElement('button');
  button.textContent = 'Card settings';
  island.append(button);
  document.body.append(island);
  const host = new ProjectDialog();
  document.body.append(host);
  const modal = host.querySelector('dialog');
  if (!modal) throw new Error('no dialog');
  const project = asProject(demoProject());
  if (!project) throw new Error('invalid fixture');
  host.show(dialogView(project));
  const layer = new EditLayer(session, new DraftStore(memoryBackend(), true), host, modal);
  layer.replaceDraft(demoDraft());
  return { layer, modal, island };
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});

describe('EditLayer (FR-381, FR-382)', () => {
  it('re-renders the real dialog from the draft and keeps the island inside it', () => {
    const { layer, modal, island } = setup();
    expect(island.parentElement).toBe(modal);
    layer.dispatch({ kind: 'settings', patch: { theme: 'navy' } });
    expect(modal.querySelector('.pd__hero')?.getAttribute('data-theme')).toBe('navy');
    expect(island.parentElement).toBe(modal);
  });

  it('keeps the last valid render when size × media is invalid', () => {
    const { layer, modal } = setup();
    layer.dispatch({ kind: 'settings', patch: { theme: 'navy' } });
    const poster = { kind: 'image', src: 'demo/cover', alt: 'Demo' } as const;
    const media = {
      kind: 'iframe',
      src: 'https://x.dev/',
      title: 'X',
      viewport: 'desktop',
      poster,
    } as const;
    layer.dispatch({ kind: 'settings', patch: { media, theme: 'paper-ink' } });
    expect(layer.previewValid).toBe(false);
    expect(modal.querySelector('.pd__hero')?.getAttribute('data-theme')).toBe('navy');
  });

  it('puts focus back on a kept control after a render', () => {
    const { layer, island } = setup();
    const button = island.querySelector('button');
    button?.focus();
    layer.dispatch({ kind: 'settings', patch: { theme: 'navy' } });
    expect(document.activeElement).toBe(button);
  });

  it('text ops do not re-render; undo does, and the edit toggle is remembered', () => {
    const { layer, modal } = setup();
    const hero = modal.querySelector('.pd__hero');
    layer.dispatch({ kind: 'text', pointer: '/title', value: 'Typed' }, 'title');
    expect(modal.querySelector('.pd__hero')).toBe(hero);
    expect(layer.changes).toBe(1);
    layer.undo();
    expect(layer.changes).toBe(0);
    expect(modal.querySelector('.pd__hero')).not.toBe(hero);
    layer.editing = false;
    expect(document.documentElement.dataset['adminEdit']).toBe('off');
    expect(localStorage.getItem('timeline:admin-edit')).toBe('off');
  });
});
