/** Same-document View Transition between two elements (FR-056). Falls back to a plain update. */
const NAME = 'project-hero';

export function morph(
  update: () => void,
  from: HTMLElement | undefined,
  to: () => HTMLElement | undefined,
  enabled: boolean,
): void {
  if (!enabled || !from || !('startViewTransition' in document)) {
    update();
    return;
  }
  from.style.viewTransitionName = NAME;
  const transition = document.startViewTransition(() => {
    from.style.viewTransitionName = '';
    update();
    const target = to();
    if (target) target.style.viewTransitionName = NAME;
  });
  void transition.finished.finally(() => {
    const target = to();
    if (target) target.style.viewTransitionName = '';
  });
}
