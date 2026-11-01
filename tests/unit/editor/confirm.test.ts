// Confirmation dialogs (spec 004 edit-layer FR-394, FR-395, FR-397, FR-399, T390).
import { beforeEach, describe, expect, it } from 'vitest';
import { confirmDialog } from '../../../src/components/admin-confirm/admin-confirm.ts';
import {
  conflictConfirm,
  deleteConfirm,
  discardConfirm,
  warningsConfirm,
} from '../../../src/core/editor/confirm.ts';
import type { Issue } from '../../../src/content/validate/index.ts';

const warning: Issue = {
  file: 'src/content/data/projects/dmns.json',
  slug: 'dmns',
  path: '/summary',
  rule: 'text-length',
  severity: 'warning',
  message: 'summary is longer than 160 characters',
};

let opener: HTMLButtonElement;
beforeEach(() => {
  document.body.replaceChildren();
  opener = document.createElement('button');
  opener.textContent = 'Publish';
  document.body.append(opener);
  opener.focus();
});

const dialog = (): HTMLDialogElement => {
  const node = document.querySelector('admin-confirm dialog');
  if (!(node instanceof HTMLDialogElement)) throw new Error('no dialog');
  return node;
};
const buttonNamed = (name: string): HTMLButtonElement => {
  const found = [...dialog().querySelectorAll('button')].find((b) => b.textContent === name);
  if (!found) throw new Error(`no button ${name}`);
  return found;
};

describe('<admin-confirm> (FR-399)', () => {
  it.each([
    ['warnings', warningsConfirm([warning])],
    ['discard', discardConfirm('dmns', 3)],
    ['conflict', conflictConfirm(['src/content/data/order.json'])],
    ['delete', deleteConfirm('dmns', [])],
  ])('%s: a modal dialog labeled by its <h2>', (_name, spec) => {
    void confirmDialog().ask(spec);
    const d = dialog();
    expect(d.open).toBe(true);
    const heading = d.querySelector('h2');
    expect(heading?.textContent).toBe(spec.heading);
    expect(d.getAttribute('aria-labelledby')).toBe(heading?.id);
    d.close('cancel');
  });

  it('resolves with the action and returns focus to the opener', async () => {
    const answer = confirmDialog().ask(warningsConfirm([warning]));
    expect(dialog().textContent).toContain('Warning: summary is longer than 160 characters');
    buttonNamed('Publish anyway').click();
    await expect(answer).resolves.toBe('publish');
    expect(document.activeElement).toBe(opener);
  });

  it('Esc cancels', async () => {
    const answer = confirmDialog().ask(discardConfirm('dmns', 2));
    expect(document.activeElement?.textContent).toBe('Keep editing');
    const d = dialog();
    d.dispatchEvent(new Event('cancel', { cancelable: true }));
    d.close();
    await expect(answer).resolves.toBe('cancel');
    expect(document.activeElement).toBe(opener);
  });

  it('Delete stays aria-disabled until the slug is typed', async () => {
    const answer = confirmDialog().ask(deleteConfirm('dmns', [warning]));
    const input = dialog().querySelector('input');
    if (!input) throw new Error('no input');
    expect(input.labels?.[0]?.textContent).toBe('Type dmns to confirm');
    expect(document.activeElement).toBe(input);
    const del = buttonNamed('Delete and publish');
    expect(del.getAttribute('aria-disabled')).toBe('true');
    del.click();
    expect(dialog().open).toBe(true);
    input.value = 'dmn';
    input.dispatchEvent(new Event('input'));
    expect(del.getAttribute('aria-disabled')).toBe('true');
    input.value = 'dmns';
    input.dispatchEvent(new Event('input'));
    expect(del.hasAttribute('aria-disabled')).toBe(false);
    del.click();
    await expect(answer).resolves.toBe('delete');
  });

  it('lists what a delete removes and any plan warnings', () => {
    const items = deleteConfirm('dmns', [warning]).blocks.flatMap((b) =>
      b.kind === 'list' ? b.items : [],
    );
    expect(items).toEqual([
      'its JSON file',
      'its place in order.json',
      'every file in media-src/dmns/',
      'Warning: summary is longer than 160 characters',
    ]);
  });

  it('conflict offers Reload from repository and Keep my draft', async () => {
    const answer = confirmDialog().ask(conflictConfirm(['a.json', 'b.json']));
    expect([...dialog().querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'a.json',
      'b.json',
    ]);
    buttonNamed('Reload from repository').click();
    await expect(answer).resolves.toBe('reload');
  });
});
