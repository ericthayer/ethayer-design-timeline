/** Arrow-key movement between cards (FR-073, FR-081). Tab order is untouched. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type NavKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

export const isNavKey = (key: string): key is NavKey =>
  ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key);

/** Index to focus next, or -1 to stay. ←/→ follow DOM order; ↑/↓ pick the nearest box by geometry. */
export function nextIndex(key: NavKey, current: number, boxes: readonly Box[]): number {
  const last = boxes.length - 1;
  switch (key) {
    case 'Home':
      return 0;
    case 'End':
      return last;
    case 'ArrowLeft':
      return current > 0 ? current - 1 : -1;
    case 'ArrowRight':
      return current < last ? current + 1 : -1;
    case 'ArrowUp':
    case 'ArrowDown': {
      const from = boxes[current];
      if (!from) return -1;
      const down = key === 'ArrowDown';
      const cx = from.x + from.width / 2;
      let best = -1;
      let bestScore = Number.POSITIVE_INFINITY;
      boxes.forEach((box, i) => {
        if (i === current) return;
        const dy = down ? box.y - (from.y + from.height) : from.y - (box.y + box.height);
        if (dy < -1) return;
        const dx = Math.abs(box.x + box.width / 2 - cx);
        const score = dy + dx * 2;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      });
      return best;
    }
  }
}
