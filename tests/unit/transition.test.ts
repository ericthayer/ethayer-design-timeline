import { afterEach, describe, expect, it, vi } from 'vitest';
import { morph } from '../../src/core/transition.ts';

/** Chrome skips a transition (hidden tab, invalid state): the update still runs and `ready` rejects. */
function skippedTransition(update: () => void): Pick<ViewTransition, 'ready' | 'finished'> {
  update();
  return {
    ready: Promise.reject(new DOMException('Transition was aborted', 'InvalidStateError')),
    finished: Promise.resolve(),
  };
}

describe('morph (FR-056)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'startViewTransition');
  });

  it('swallows a skipped transition and still updates and clears names', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: skippedTransition,
    });
    const from = document.createElement('div');
    const to = document.createElement('div');
    const update = vi.fn();

    morph(update, from, () => to, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off('unhandledRejection', onUnhandled);

    expect(update).toHaveBeenCalledOnce();
    expect(from.style.viewTransitionName).toBe('');
    expect(to.style.viewTransitionName).toBe('');
    expect(unhandled).toEqual([]);
  });
});
