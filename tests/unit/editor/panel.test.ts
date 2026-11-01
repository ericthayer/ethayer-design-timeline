// Card settings panel (spec 004 edit-layer FR-388–FR-390, FR-395, T388).
import { describe, expect, it } from 'vitest';
import { installPanel } from '../../../src/admin/edit/panel-wiring.ts';
import { ToolbarController } from '../../../src/admin/edit/toolbar-wiring.ts';
import { Validation } from '../../../src/admin/edit/validation.ts';
import type { AdminPanel } from '../../../src/components/admin-panel/admin-panel.ts';
import { baseBundle } from '../../fixtures/content/bundle.ts';
import { baseProject } from '../../fixtures/content/projects.ts';
import { setup } from './dom.ts';
import { demoDraft } from './fixtures.ts';

function mount(): ReturnType<typeof setup> & { panel: AdminPanel; toolbar: ToolbarController } {
  const ctx = setup(demoDraft());
  const validation = new Validation(ctx.layer);
  const toolbar = new ToolbarController(ctx.layer, validation);
  const panel = installPanel(ctx.layer, validation, toolbar);
  ctx.layer.replaceDraft(ctx.layer.draft ?? demoDraft(), baseBundle({ demo: baseProject('demo') }));
  ctx.modal.dispatchEvent(new CustomEvent('editor:action', { detail: { kind: 'settings' } }));
  return { ...ctx, panel, toolbar };
}

const control = <T extends HTMLElement>(root: ParentNode, key: string, type: new () => T): T => {
  const node = root.querySelector(`[data-focus-key="${key}"]`);
  if (!(node instanceof type)) throw new Error(`no control ${key}`);
  return node;
};

describe('card settings panel (FR-388)', () => {
  it('opens inside the dialog, focuses its heading, and reports open to the toolbar', () => {
    const { panel, modal, toolbar } = mount();
    expect(panel.parentElement).toBe(modal);
    expect(panel.hidden).toBe(false);
    expect(document.activeElement?.id).toBe('ed-panel-h');
    expect(toolbar.state().panelOpen).toBe(true);
  });

  it('gives every control a visible label', () => {
    const { panel } = mount();
    const controls = panel.querySelectorAll('input, select');
    expect(controls.length).toBeGreaterThan(10);
    for (const node of controls) {
      const label = node.closest('label');
      const text = label?.querySelector('.edp__label')?.textContent ?? label?.textContent ?? '';
      expect(text.trim(), node.id).not.toBe('');
    }
  });

  it('re-renders the dialog on a theme change and keeps focus on the select', () => {
    const { panel, layer } = mount();
    const theme = control(panel, 'theme', HTMLSelectElement);
    const next = [...theme.options].find((o) => !o.selected)?.value ?? '';
    theme.focus();
    theme.value = next;
    theme.dispatchEvent(new Event('change'));
    expect(layer.draft?.working.theme).toBe(next);
    const after = control(panel, 'theme', HTMLSelectElement);
    expect(after.value).toBe(next);
    expect(document.activeElement).toBe(after);
  });

  it('keeps the last valid preview and shows the error for an invalid size × media', () => {
    const { panel, layer, modal } = mount();
    const title = modal.querySelector('#pd-title')?.textContent;
    layer.dispatch({
      kind: 'settings',
      patch: {
        media: {
          kind: 'iframe',
          src: 'https://example.com/',
          title: 'Live site',
          viewport: 'desktop',
          poster: { kind: 'image', src: 'demo/cover', alt: '' },
        },
      },
    });
    expect(layer.previewValid).toBe(false);
    expect(layer.draft?.working.size).toBe('sm');
    expect(modal.querySelector('#pd-title')?.textContent).toBe(title);
    expect(panel.textContent).toMatch(/last valid/i);
    expect(modal.querySelector('#pd-title')).not.toBeNull();
  });

  it('Esc closes only the panel and returns focus to Card settings', () => {
    const { panel, modal, toolbar } = mount();
    const settings = toolbar.toolbar.control('settings');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.hidden).toBe(true);
    expect(modal.open).toBe(true);
    expect(toolbar.state().panelOpen).toBe(false);
    if (settings?.isConnected) expect(document.activeElement).toBe(settings);
  });
});
