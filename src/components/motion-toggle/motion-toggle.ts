import { defineOnce, el } from '../../core/dom.ts';
import { getMotion } from '../../core/motion.ts';

/** <motion-toggle>: "Pause motion" button, pressed while motion is paused (FR-080, SC 2.2.2). */
export class MotionToggle extends HTMLElement {
  private readonly button = el('button', { type: 'button', class: 'motion-toggle' }, [
    el('span', { class: 'motion-toggle__icon', 'aria-hidden': 'true' }),
    el('span', {}, ['Pause motion']),
  ]);
  private unsubscribe: (() => void) | undefined;

  connectedCallback(): void {
    const motion = getMotion();
    if (!this.button.isConnected) this.append(this.button);
    this.button.addEventListener('click', this.onClick);
    this.unsubscribe = motion.subscribe(() => {
      this.sync();
    });
    this.sync();
  }

  disconnectedCallback(): void {
    this.button.removeEventListener('click', this.onClick);
    this.unsubscribe?.();
  }

  private sync(): void {
    this.button.setAttribute('aria-pressed', String(getMotion().paused));
  }

  private readonly onClick = (): void => {
    const motion = getMotion();
    motion.setPaused(!motion.paused);
  };
}

export function define(): void {
  defineOnce('motion-toggle', MotionToggle);
}
