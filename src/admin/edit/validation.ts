// Debounced validation (spec 004 edit-layer FR-395): every change schedules `buildChanges` 300 ms
// later; blur and Publish run it at once. The plan functions are the only rule logic.
import { type Built, buildChanges } from '../../core/editor/changes.ts';
import { EDITOR_CONTEXT } from './bundled.ts';
import type { EditLayer } from './edit-layer.ts';

export class Validation extends EventTarget {
  built: Built | null = null;
  readonly #layer: EditLayer;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(layer: EditLayer) {
    super();
    this.#layer = layer;
    layer.addEventListener('change', () => {
      this.schedule();
    });
  }

  schedule(delayMs = 300): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.now();
    }, delayMs);
  }

  /** Validates the open draft now and returns the result. */
  now(): Built | null {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    const { draft, raw } = this.#layer;
    this.built = draft === null || raw === null ? null : buildChanges(draft, raw, EDITOR_CONTEXT);
    this.dispatchEvent(new Event('validated'));
    return this.built;
  }
}
