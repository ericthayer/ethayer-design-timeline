/** Vertical wheel → horizontal scroll in horizontal mode (FR-005). */
const LINE_PX = 16;

export function normalizeWheelDelta(
  event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>,
  pagePx: number,
): number {
  if (event.deltaMode === 1) return event.deltaY * LINE_PX;
  if (event.deltaMode === 2) return event.deltaY * pagePx;
  return event.deltaY;
}

/** True when this wheel event should be remapped (vertical-dominant, not a zoom gesture). */
export function shouldRemap(
  event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'ctrlKey' | 'metaKey'>,
): boolean {
  if (event.ctrlKey || event.metaKey) return false;
  return Math.abs(event.deltaY) > Math.abs(event.deltaX);
}

export function attachWheelToHorizontal(
  scroller: HTMLElement,
  isActive: () => boolean,
): () => void {
  const onWheel = (event: WheelEvent): void => {
    if (!isActive() || !shouldRemap(event)) return;
    event.preventDefault();
    scroller.scrollLeft += normalizeWheelDelta(event, scroller.clientWidth);
  };
  scroller.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    scroller.removeEventListener('wheel', onWheel);
  };
}
