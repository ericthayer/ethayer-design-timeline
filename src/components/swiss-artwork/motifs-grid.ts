// Grid-based motifs (data-model §4). All draw in a 100×100 viewBox with theme classes.
import { svg } from '../../core/dom.ts';
import { randInt } from '../../core/rng.ts';
import type { MotifContext } from './motif-types.ts';

const INSET = 8;
const AREA = 100 - INSET * 2;

/** Lens petals alternating diagonal; one rotated outlier in accent. */
export function petals({ rng, outlier }: MotifContext): SVGElement[] {
  const n = 4;
  const s = AREA / n;
  const odd = outlier ? randInt(rng, 0, n * n - 1) : -1;
  const nodes: SVGElement[] = [];
  for (let i = 0; i < n * n; i += 1) {
    const x = INSET + (i % n) * s;
    const y = INSET + Math.floor(i / n) * s;
    const flip = (((i % n) + Math.floor(i / n)) % 2 === 1) !== (i === odd);
    const d = flip
      ? `M${x + s} ${y}A${s} ${s} 0 0 1 ${x} ${y + s}A${s} ${s} 0 0 1 ${x + s} ${y}Z`
      : `M${x} ${y}A${s} ${s} 0 0 1 ${x + s} ${y + s}A${s} ${s} 0 0 1 ${x} ${y}Z`;
    nodes.push(svg('path', { d, class: i === odd ? 'a3' : 'a1' }));
  }
  return nodes;
}

/** Rows of bars on a strict grid; one bar drifts off-grid (the outlier). */
export function driftBars({ rng, outlier }: MotifContext): SVGElement[] {
  const rows = 7;
  const cols = 3;
  const gap = 3;
  const w = (AREA - gap * (cols - 1)) / cols;
  const h = (AREA - gap * (rows - 1)) / rows;
  const accents = ['a2', 'a3', 'a4'];
  const drift = outlier ? randInt(rng, 0, rows * cols - 1) : -1;
  const nodes: SVGElement[] = [];
  for (let i = 0; i < rows * cols; i += 1) {
    const x = INSET + (i % cols) * (w + gap);
    const y = INSET + Math.floor(i / cols) * (h + gap);
    const cls = rng() < 0.16 ? (accents[randInt(rng, 0, 2)] ?? 'a2') : 'a1';
    const rect = svg('rect', { x, y, width: w, height: h, class: i === drift ? 'a3' : cls });
    if (i === drift) {
      const angle = randInt(rng, 10, 22) * (rng() < 0.5 ? -1 : 1);
      rect.setAttribute(
        'transform',
        `rotate(${angle} ${x + w / 2} ${y + h / 2}) translate(${w * 0.18} ${h * 0.4})`,
      );
    }
    nodes.push(rect);
  }
  return nodes;
}

/** Square lattice whose rotation grows with distance from a seeded center. */
export function scatter({ rng }: MotifContext): SVGElement[] {
  const n = 9;
  const step = AREA / n;
  const size = step * 0.52;
  const cx = randInt(rng, 2, n - 3);
  const cy = randInt(rng, 2, n - 3);
  const nodes: SVGElement[] = [];
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const x = INSET + col * step + (step - size) / 2;
      const y = INSET + row * step + (step - size) / 2;
      const angle = Math.round(Math.hypot(col - cx, row - cy) * 11) % 90;
      nodes.push(
        svg('rect', {
          x,
          y,
          width: size,
          height: size,
          class: 'a1',
          transform: `rotate(${angle} ${x + size / 2} ${y + size / 2})`,
        }),
      );
    }
  }
  return nodes;
}

/** Circle grid with a stepped tonal ramp per row (classes t0–t4 mix art-1 → art-3). */
export function toneDots({ rng, outlier }: MotifContext): SVGElement[] {
  const cols = 6;
  const rows = 5;
  const step = AREA / cols;
  const r = step * 0.44;
  const odd = outlier ? randInt(rng, 0, cols * rows - 1) : -1;
  const nodes: SVGElement[] = [];
  for (let i = 0; i < cols * rows; i += 1) {
    const row = Math.floor(i / cols);
    nodes.push(
      svg('circle', {
        cx: INSET + (i % cols) * step + step / 2,
        cy: INSET + row * (AREA / rows) + AREA / rows / 2,
        r,
        class: i === odd ? 'a2' : `t${row}`,
      }),
    );
  }
  return nodes;
}

/** Dot lattice over a hairline grid; one larger ink dot marks the spot. */
export function dotGridMark({ rng, outlier }: MotifContext): SVGElement[] {
  const n = 7;
  const step = AREA / n;
  const nodes: SVGElement[] = [];
  for (let k = 0; k <= n; k += 1) {
    const p = INSET + k * step;
    nodes.push(svg('line', { x1: p, y1: INSET, x2: p, y2: 100 - INSET, class: 'hair' }));
    nodes.push(svg('line', { x1: INSET, y1: p, x2: 100 - INSET, y2: p, class: 'hair' }));
  }
  const mark = outlier ? randInt(rng, 0, n * n - 1) : -1;
  for (let i = 0; i < n * n; i += 1) {
    const cx = INSET + (i % n) * step + step / 2;
    const cy = INSET + Math.floor(i / n) * step + step / 2;
    const isMark = i === mark;
    nodes.push(
      svg('circle', { cx, cy, r: step * (isMark ? 0.46 : 0.36), class: isMark ? 'a2' : 'a1' }),
    );
  }
  return nodes;
}
