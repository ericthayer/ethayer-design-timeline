import { el } from '../../core/dom.ts';
import './dialog-split.css';

/** Overview pane share of the dialog width, in percent (spec 006, FR-534). */
export const SPLIT = { min: 28, max: 60, initial: 40, step: 4 } as const;

/** The chosen split holds across projects until the page reloads (no storage). */
let current: number = SPLIT.initial;

export const clampSplit = (value: number): number =>
  Math.min(SPLIT.max, Math.max(SPLIT.min, Math.round(value)));

/** The split a key moves to, or null when the key doesn't resize. */
export function splitForKey(key: string, value: number): number | null {
  switch (key) {
    case 'ArrowLeft':
      return clampSplit(value - SPLIT.step);
    case 'ArrowRight':
      return clampSplit(value + SPLIT.step);
    case 'Home':
      return SPLIT.min;
    case 'End':
      return SPLIT.max;
    default:
      return null;
  }
}

/**
 * A vertical separator that resizes the overview pane by pointer drag or keyboard (FR-534).
 * It writes `--pd-split` on `container`, the grid that holds both panes.
 */
export function buildResizer(container: HTMLElement, controls: string): HTMLElement {
  const handle = el('div', {
    class: 'pd__split',
    role: 'separator',
    tabindex: 0,
    'aria-orientation': 'vertical',
    'aria-label': 'Resize the overview panel',
    'aria-controls': controls,
    'aria-valuemin': SPLIT.min,
    'aria-valuemax': SPLIT.max,
  });

  const apply = (value: number): void => {
    current = clampSplit(value);
    container.style.setProperty('--pd-split', `${current}%`);
    handle.setAttribute('aria-valuenow', String(current));
    handle.setAttribute('aria-valuetext', `Overview ${current}% of the width`);
  };
  apply(current);

  // Arrow keys here resize; they must not reach the dialog, where they change project.
  handle.addEventListener('keydown', (event) => {
    const next = splitForKey(event.key, current);
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    apply(next);
  });

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    handle.dataset['dragging'] = '';
    const box = container.getBoundingClientRect();
    const move = (e: PointerEvent): void => {
      if (box.width > 0) apply(((e.clientX - box.left) / box.width) * 100);
    };
    const end = (): void => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      delete handle.dataset['dragging'];
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });

  return handle;
}
