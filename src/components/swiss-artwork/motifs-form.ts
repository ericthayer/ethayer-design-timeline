// Form-based motifs (data-model §4). All draw in a 100×100 viewBox with theme classes.
import { svg } from '../../core/dom.ts';
import { randInt } from '../../core/rng.ts';
import type { MotifContext } from './motif-types.ts';

/** Two offset ellipses: a filled disc eclipsed by a crescent. */
export function eclipse({ rng, outlier }: MotifContext): SVGElement[] {
  const shift = randInt(rng, 6, 12);
  const nodes: SVGElement[] = [
    svg('ellipse', { cx: 50 - shift / 2, cy: 52, rx: 36, ry: 40, class: 'a1' }),
    svg('ellipse', { cx: 50 + shift, cy: 52, rx: 27, ry: 38, class: 'a2' }),
    svg('ellipse', { cx: 50 + shift * 0.4, cy: 52, rx: 19, ry: 33, class: 'bg' }),
  ];
  if (outlier) nodes.push(svg('circle', { cx: 50 + shift * 0.4, cy: 52, r: 4, class: 'a3' }));
  return nodes;
}

/** Parallel diagonal stripes inside a square frame; the outlier is a missing stripe. */
export function diagonalLines({ rng, outlier }: MotifContext): SVGElement[] {
  const step = 4.4;
  const gap = outlier ? randInt(rng, 8, 30) : -1;
  const lines: SVGElement[] = [];
  for (let k = 0, i = 0; k <= 200; k += step, i += 1) {
    if (i === gap) continue;
    lines.push(svg('line', { x1: k - 100, y1: 100, x2: k, y2: 0, class: 'stroke-a1' }));
  }
  // A nested <svg> clips to its own viewport, so no document-unique clipPath id is needed.
  return [svg('svg', { x: 10, y: 10, width: 80, height: 80, viewBox: '10 10 80 80' }, lines)];
}

/** Squares nested at alternating 45° turns, alternating fill. */
export function nestedSquares({ rng, outlier }: MotifContext): SVGElement[] {
  const levels = 8;
  const accent = outlier ? randInt(rng, 2, levels - 2) : -1;
  const nodes: SVGElement[] = [];
  let half = 42;
  for (let level = 0; level < levels; level += 1) {
    const rotated = level % 2 === 1;
    const cls = level === accent ? 'a3' : level % 2 === 0 ? 'a1' : 'bg';
    nodes.push(
      svg('rect', {
        x: 50 - half,
        y: 50 - half,
        width: half * 2,
        height: half * 2,
        class: cls,
        transform: rotated ? 'rotate(45 50 50)' : undefined,
      }),
    );
    half /= Math.SQRT2; // each square inscribes the next at 45°
  }
  return nodes;
}

/** Horizontal bars tapering in thickness toward the horizon. */
export function horizonLines({ rng, outlier }: MotifContext): SVGElement[] {
  const bars = 16;
  const accent = outlier ? randInt(rng, 3, bars - 3) : -1;
  const nodes: SVGElement[] = [];
  let y = 92;
  for (let i = 0; i < bars; i += 1) {
    const h = 4.2 * (1 - i / bars) + 0.5;
    y -= h;
    nodes.push(svg('rect', { x: 8, y, width: 84, height: h, class: i === accent ? 'a3' : 'a1' }));
    y -= 1.6 + i * 0.12;
  }
  return nodes;
}
