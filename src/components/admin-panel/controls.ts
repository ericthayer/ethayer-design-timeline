// Labeled form controls for the settings panel (spec 004 edit-layer FR-388, FR-399). Every
// control has a visible label; values go in through properties, never markup.
import { el } from '../../core/dom.ts';

/** `data-pointer` ties a control to validator issues; `data-focus-key` keeps focus across rebuilds. */
export interface ControlKeys {
  readonly key: string;
  readonly pointer?: string;
}

function keyed<T extends HTMLElement>(node: T, keys: ControlKeys): T {
  node.dataset['focusKey'] = keys.key;
  if (keys.pointer !== undefined) node.dataset['pointer'] = keys.pointer;
  node.id = `edp-${keys.key}`;
  return node;
}

/** `<label><span>Label</span> control</label>` */
export function labeled(text: string, control: HTMLElement): HTMLLabelElement {
  return el('label', { class: 'edp__field' }, [
    el('span', { class: 'edp__label' }, [text]),
    control,
  ]);
}

export function textInput(
  text: string,
  value: string,
  keys: ControlKeys,
  onChange: (value: string) => void,
  type: 'text' | 'url' | 'month' | 'number' = 'text',
): HTMLLabelElement {
  const input = keyed(el('input', { type }), keys);
  input.value = value;
  input.addEventListener('change', () => {
    onChange(input.value);
  });
  return labeled(text, input);
}

export function select<T extends string>(
  text: string,
  options: readonly (readonly [T, string])[],
  value: T,
  keys: ControlKeys,
  onChange: (value: T) => void,
): HTMLLabelElement {
  const control = keyed(el('select'), keys);
  for (const [optionValue, label] of options) {
    const option = el('option', { value: optionValue }, [label]);
    option.selected = optionValue === value;
    control.append(option);
  }
  control.addEventListener('change', () => {
    const picked = options.find(([v]) => v === control.value);
    if (picked) onChange(picked[0]);
  });
  return labeled(text, control);
}

export function radios<T extends string>(
  legend: string,
  options: readonly (readonly [T, string])[],
  value: T,
  keys: ControlKeys,
  onChange: (value: T) => void,
): HTMLFieldSetElement {
  const set = el('fieldset', { class: 'edp__radios' }, [el('legend', {}, [legend])]);
  if (keys.pointer !== undefined) set.dataset['pointer'] = keys.pointer;
  for (const [optionValue, label] of options) {
    const input = keyed(el('input', { type: 'radio', name: `edp-${keys.key}` }), {
      key: `${keys.key}-${optionValue}`,
    });
    input.checked = optionValue === value;
    input.addEventListener('change', () => {
      if (input.checked) onChange(optionValue);
    });
    set.append(el('label', { class: 'edp__radio' }, [input, label]));
  }
  return set;
}

export function checkbox(
  text: string,
  checked: boolean,
  keys: ControlKeys,
  onChange: (checked: boolean) => void,
): HTMLLabelElement {
  const input = keyed(el('input', { type: 'checkbox' }), keys);
  input.checked = checked;
  input.addEventListener('change', () => {
    onChange(input.checked);
  });
  return el('label', { class: 'edp__check' }, [input, text]);
}

export function button(
  text: string,
  keys: ControlKeys,
  onClick: (() => void) | null,
  label?: string,
): HTMLButtonElement {
  const node = keyed(el('button', { type: 'button', class: 'edp__btn' }, [text]), keys);
  if (label !== undefined) node.setAttribute('aria-label', label);
  if (onClick === null) node.setAttribute('aria-disabled', 'true');
  node.addEventListener('click', () => {
    onClick?.();
  });
  return node;
}

export function fieldset(
  legend: string,
  id: string,
  children: readonly Node[],
): HTMLFieldSetElement {
  return el('fieldset', { class: 'edp__section', id: `edp-section-${id}` }, [
    el('legend', {}, [legend]),
    ...children,
  ]);
}

/** Options from plain values that read the same as their labels. */
export const same = <T extends string>(values: readonly T[]): (readonly [T, string])[] =>
  values.map((v) => [v, v] as const);
