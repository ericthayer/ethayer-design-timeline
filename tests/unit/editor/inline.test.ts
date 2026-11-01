// Inline editing (spec 004 edit-layer FR-386, FR-387, FR-395, T387).
import { describe, expect, it } from 'vitest';
import { insertPlain, installInline, plainValue } from '../../../src/admin/edit/inline.ts';
import { Validation } from '../../../src/admin/edit/validation.ts';
import { baseBundle } from '../../fixtures/content/bundle.ts';
import { baseProject } from '../../fixtures/content/projects.ts';
import { setup } from './dom.ts';
import { demoDraft, demoProject } from './fixtures.ts';

const tile = {
  media: { kind: 'placeholder', variant: 'site' },
  label: 'Placeholder · Home',
} as const;

function mount(): ReturnType<typeof setup> & { validation: Validation } {
  const working = demoProject({
    tracklist: [{ label: 'TypeScript' }, { label: 'Vue 3', value: 'Lead' }],
    metrics: [{ value: '40%', label: 'Faster' }],
    gallery: [tile],
  });
  const ctx = setup(demoDraft(working));
  const validation = new Validation(ctx.layer);
  installInline(ctx.layer, validation);
  ctx.layer.replaceDraft(ctx.layer.draft ?? demoDraft(), baseBundle({ demo: baseProject('demo') }));
  return { ...ctx, validation };
}

const fieldAt = (modal: HTMLElement, pointer: string): HTMLElement => {
  const node = modal.querySelector<HTMLElement>(`[data-pointer="${pointer}"]`);
  if (!node) throw new Error(`no field ${pointer}`);
  return node;
};

describe('inline fields (FR-386)', () => {
  it('wraps every inline text in a labeled plain-text span, and headings keep their role', () => {
    const { modal } = mount();
    const pointers = [...modal.querySelectorAll<HTMLElement>('.ed-field')].map(
      (f) => f.dataset['pointer'],
    );
    expect(pointers).toEqual([
      '/title',
      '/tracklist/0/label',
      '/tracklist/0/value',
      '/tracklist/1/label',
      '/tracklist/1/value',
      '/summary',
      '/body/context',
      '/body/contribution',
      '/body/outcome',
      '/metrics/0/value',
      '/metrics/0/label',
      '/gallery/0/label',
    ]);
    const title = fieldAt(modal, '/title');
    expect(title.parentElement?.tagName).toBe('H2');
    expect(title.getAttribute('role')).toBe('textbox');
    expect(title.getAttribute('aria-label')).toBe('Title');
    expect(fieldAt(modal, '/tracklist/1/value').getAttribute('aria-label')).toBe('Track 2 value');
    expect(title.getAttribute('contenteditable')).toMatch(/^(plaintext-only|true)$/);
  });

  it('commits textContent with NBSP as a space and trimmed ends', () => {
    const { modal, layer } = mount();
    const title = fieldAt(modal, '/title');
    title.textContent = '  New title ';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    expect(layer.draft?.working.title).toBe('New title');
    expect(plainValue(' a b ')).toBe('a b');
  });

  it('blocks Enter and line breaks, and pastes plain text only', () => {
    const { modal, layer } = mount();
    const title = fieldAt(modal, '/title');
    const enter = new InputEvent('beforeinput', {
      inputType: 'insertParagraph',
      bubbles: true,
      cancelable: true,
    });
    title.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    title.textContent = 'Demo';
    const range = document.createRange();
    range.selectNodeContents(title);
    range.collapse(false);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    insertPlain(' <b>bold</b>\nline');
    expect(title.textContent).toContain('Demo <b>bold</b> line');
    expect(title.querySelector('b')).toBeNull();
    title.dispatchEvent(new Event('input', { bubbles: true }));
    expect(layer.draft?.working.title).toBe('Demo <b>bold</b> line');
  });
});

describe('list rows (FR-387)', () => {
  it('labels row buttons with the row and focuses the new row after Add', () => {
    const { modal, layer } = mount();
    const labels = [...modal.querySelectorAll('.pd__tracks .ed-row-btn')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels).toContain('Remove track 2: Vue 3');
    expect(labels).toContain('Move earlier track 2: Vue 3');
    const add = modal.querySelector<HTMLButtonElement>('[data-focus-key="ed-add-tracklist"]');
    add?.click();
    expect(layer.draft?.working.tracklist).toHaveLength(3);
    expect(document.activeElement?.getAttribute('data-pointer')).toBe('/tracklist/2/label');
    const remove = modal.querySelector<HTMLButtonElement>(
      '[data-focus-key="ed-remove-tracklist-0"]',
    );
    remove?.click();
    expect(layer.draft?.working.tracklist.map((t) => t.label)).toEqual(['Vue 3', 'New track']);
    expect(document.activeElement?.getAttribute('data-pointer')).toBe('/tracklist/0/label');
  });
});

describe('inline errors (FR-395)', () => {
  it('sets aria-invalid with a joined error that never sits directly in a <ul>', () => {
    const { modal, layer, validation } = mount();
    const caption = fieldAt(modal, '/gallery/0/label');
    caption.textContent = '';
    caption.dispatchEvent(new Event('input', { bubbles: true }));
    validation.now();
    const again = fieldAt(modal, '/gallery/0/label');
    expect(again.getAttribute('aria-invalid')).toBe('true');
    const error = document.getElementById(again.getAttribute('aria-describedby') ?? '');
    expect(error?.className).toBe('ed-error');
    expect(error?.parentElement?.tagName).not.toBe('UL');
    expect(layer.draft?.working.gallery?.[0]?.label).toBe('');
  });

  it('edit mode off renders a clean preview', () => {
    const { modal, layer } = mount();
    layer.editing = false;
    expect(modal.querySelector('.ed-field, .ed-row-btn')).toBeNull();
    layer.editing = true;
    expect(modal.querySelector('.ed-field')).not.toBeNull();
  });
});
