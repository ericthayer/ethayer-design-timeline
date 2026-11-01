// Inline editing (spec 004 edit-layer FR-386, FR-387, FR-395, FR-399): text fields become
// plain-text `.ed-field` spans inside their hosts, list rows get labeled buttons, and validator
// issues land on their fields. Reads use textContent only; pasted HTML is never inserted.
import { el } from '../../core/dom.ts';
import { placeIssues } from '../../core/editor/issues.ts';
import type { EditOp, ListName } from '../../core/editor/ops.ts';
import { projectFile } from '../../content/paths.ts';
import type { EditLayer } from './edit-layer.ts';
import type { Validation } from './validation.ts';
import './edit.css';

/** NBSP → space and trimmed ends: the value a field commits (FR-386). */
export const plainValue = (text: string): string => text.replace(/\u00a0/g, ' ').trim();

let plaintextOnly: boolean | null = null;
function editableMode(): string {
  if (plaintextOnly === null) {
    const probe = document.createElement('span');
    try {
      probe.contentEditable = 'plaintext-only';
      plaintextOnly = probe.contentEditable === 'plaintext-only';
    } catch {
      plaintextOnly = false;
    }
  }
  return plaintextOnly ? 'plaintext-only' : 'true';
}

/** Wraps a host's text in an editable span (FR-386). Headings keep their role. */
function field(host: Element | null | undefined, pointer: string, label: string): void {
  if (!host || host.querySelector('.ed-field')) return;
  const span = el('span', {
    class: 'ed-field',
    'data-pointer': pointer,
    role: 'textbox',
    'aria-label': label,
    spellcheck: 'true',
    contenteditable: editableMode(),
  });
  span.textContent = host.textContent;
  host.replaceChildren(span);
}

const STORY = [
  ['context', 'Context'],
  ['contribution', 'Contribution'],
  ['outcome', 'Outcome'],
] as const;

type RowList = Extract<ListName, 'tracklist' | 'metrics'>;
const ROWS: Record<RowList, { noun: string; list: string }> = {
  tracklist: { noun: 'track', list: '.pd__tracks' },
  metrics: { noun: 'metric', list: '.pd__metrics' },
};

function rowButton(
  layer: EditLayer,
  text: string,
  key: string,
  op: EditOp | null,
  focus: string | null,
): HTMLElement {
  const button = el('button', { type: 'button', class: 'ed-row-btn', 'data-focus-key': key }, [
    text,
  ]);
  if (op === null) button.setAttribute('aria-disabled', 'true');
  button.addEventListener('click', () => {
    if (op === null) return;
    layer.focusNext = focus;
    layer.dispatch(op);
  });
  return button;
}

/** Add, Remove, and Move earlier/later for track and metric rows (FR-387). */
function rows(modal: HTMLDialogElement, layer: EditLayer, list: RowList): void {
  const items = layer.draft?.working[list] ?? [];
  const { noun } = ROWS[list];
  const ul = modal.querySelector(ROWS[list].list);
  const first = list === 'tracklist' ? 'label' : 'value';
  ul?.querySelectorAll(':scope > li').forEach((li, i) => {
    const name = `${noun} ${String(i + 1)}: ${items[i]?.label ?? ''}`;
    const next = i + 1 < items.length ? `/${list}/${String(i)}/${first}` : `ed-add-${list}`;
    li.append(
      el('span', { class: 'ed-row' }, [
        rowButton(
          layer,
          'Move earlier',
          `ed-up-${list}-${String(i)}`,
          i > 0 ? { kind: 'move', list, from: i, to: i - 1 } : null,
          `ed-up-${list}-${String(i - 1)}`,
        ),
        rowButton(
          layer,
          'Move later',
          `ed-down-${list}-${String(i)}`,
          i + 1 < items.length ? { kind: 'move', list, from: i, to: i + 1 } : null,
          `ed-down-${list}-${String(i + 1)}`,
        ),
        rowButton(
          layer,
          'Remove',
          `ed-remove-${list}-${String(i)}`,
          { kind: 'remove', list, index: i },
          next,
        ),
      ]),
    );
    for (const button of li.querySelectorAll('.ed-row-btn')) {
      button.setAttribute('aria-label', `${button.textContent} ${name}`);
    }
  });
  const at = items.length;
  const add: EditOp =
    list === 'tracklist'
      ? { kind: 'add', list, item: { label: 'New track' } }
      : { kind: 'add', list, item: { value: '0', label: 'New metric' } };
  const button = rowButton(
    layer,
    `Add ${noun}`,
    `ed-add-${list}`,
    add,
    `/${list}/${String(at)}/${first}`,
  );
  if (ul) ul.after(button);
  else if (list === 'metrics') modal.querySelector('.pd__story')?.after(button);
}

/** The decorator: run after every render while edit mode is on. */
function decorate(modal: HTMLDialogElement, layer: EditLayer): void {
  if (!layer.editing || layer.draft === null || layer.readOnly !== null) return;
  field(modal.querySelector('#pd-title'), '/title', 'Title');
  field(modal.querySelector('.pd__summary'), '/summary', 'Summary');
  modal.querySelectorAll('.pd__story p').forEach((p, i) => {
    const story = STORY[i];
    if (story) field(p, `/body/${story[0]}`, story[1]);
  });
  modal.querySelectorAll('.pd__tracks > li').forEach((li, i) => {
    const n = String(i + 1);
    const [label, value] = li.querySelectorAll(':scope > span');
    field(label, `/tracklist/${String(i)}/label`, `Track ${n} label`);
    const valueHost = value ?? li.appendChild(el('span', { class: 'ed-empty' }));
    field(valueHost, `/tracklist/${String(i)}/value`, `Track ${n} value`);
  });
  modal.querySelectorAll('.pd__metrics > li').forEach((li, i) => {
    const n = String(i + 1);
    field(
      li.querySelector('.pd__metric-value'),
      `/metrics/${String(i)}/value`,
      `Metric ${n} value`,
    );
    field(
      li.querySelector('.pd__metric-label'),
      `/metrics/${String(i)}/label`,
      `Metric ${n} label`,
    );
  });
  modal.querySelectorAll('.pd__tile').forEach((tile, i) => {
    field(
      tile.querySelector('.pd__tile-label'),
      `/gallery/${String(i)}/label`,
      `Tile ${String(i + 1)} caption`,
    );
  });
  rows(modal, layer, 'tracklist');
  rows(modal, layer, 'metrics');
}

/** Puts each issue on its field: `aria-invalid` plus a joined error span (FR-395). */
export function showErrors(
  modal: HTMLDialogElement,
  layer: EditLayer,
  validation: Validation,
): void {
  for (const node of modal.querySelectorAll('.ed-error')) node.remove();
  const fields = new Map<string, HTMLElement>();
  for (const node of modal.querySelectorAll<HTMLElement>('.ed-field[data-pointer]')) {
    node.removeAttribute('aria-invalid');
    node.removeAttribute('aria-describedby');
    const pointer = node.dataset['pointer'];
    if (pointer !== undefined) fields.set(pointer, node);
  }
  const slug = layer.slug;
  if (slug === null) return;
  const placed = placeIssues(validation.built?.issues ?? [], projectFile(slug), fields.keys());
  let n = 0;
  for (const [pointer, issues] of placed.byField) {
    const node = fields.get(pointer);
    const host = node?.parentElement;
    if (!node || !host) continue;
    n += 1;
    const id = `ed-error-${String(n)}`;
    const error = el('span', { id, class: 'ed-error' }, [issues.map((i) => i.message).join(' ')]);
    if (host.tagName === 'LI') host.append(error);
    else host.after(error);
    node.setAttribute('aria-invalid', String(issues.some((i) => i.severity === 'error')));
    node.setAttribute('aria-describedby', id);
  }
}

/** Inserts plain text at the caret through a Range (FR-386). */
export function insertPlain(text: string): void {
  const selection = getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!range) return;
  range.deleteContents();
  const node = document.createTextNode(text.replace(/[\r\n]+/g, ' '));
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

const fieldOf = (target: EventTarget | null): HTMLElement | null =>
  target instanceof HTMLElement ? target.closest<HTMLElement>('.ed-field') : null;

/** Wires inline editing to the layer. Listeners sit on the modal once; fields come and go. */
export function installInline(layer: EditLayer, validation: Validation): void {
  const { modal } = layer;
  let composing = false;
  const commit = (node: HTMLElement): void => {
    const pointer = node.dataset['pointer'];
    if (pointer !== undefined) {
      layer.dispatch({ kind: 'text', pointer, value: plainValue(node.textContent) }, pointer);
    }
  };
  modal.addEventListener('beforeinput', (event) => {
    if (!fieldOf(event.target)) return;
    const type = event.inputType;
    if (type.startsWith('format') || type === 'insertParagraph' || type === 'insertLineBreak') {
      event.preventDefault();
    } else if (type === 'insertFromPaste' || type === 'insertFromDrop') {
      event.preventDefault();
      insertPlain(event.dataTransfer?.getData('text/plain') ?? '');
      const node = fieldOf(event.target);
      if (node) commit(node);
    }
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && fieldOf(event.target)) event.preventDefault();
  });
  modal.addEventListener('compositionstart', () => {
    composing = true;
  });
  modal.addEventListener('compositionend', (event) => {
    composing = false;
    const node = fieldOf(event.target);
    if (node) commit(node);
  });
  modal.addEventListener('input', (event) => {
    const node = fieldOf(event.target);
    if (node && !composing) commit(node);
  });
  modal.addEventListener('focusout', (event) => {
    if (!fieldOf(event.target)) return;
    layer.endGroup();
    validation.now();
  });
  layer.onDecorate(decorate);
  layer.onDecorate((m) => {
    showErrors(m, layer, validation);
  });
  validation.addEventListener('validated', () => {
    if (modal.open) showErrors(modal, layer, validation);
  });
}
