// Batch B motifs (spec 003, FR-200): the deferred set from data-model §4. Same contract as
// batch A: a 100×100 viewBox, theme classes only, seeded rng, one optional outlier.
import { svg } from '../../core/dom.ts';
import { randInt } from '../../core/rng.ts';
import type { MotifContext } from './motif-types.ts';

const INSET = 8;
const AREA = 100 - INSET * 2;
const TAU = Math.PI * 2;

const polar = (cx: number, cy: number, r: number, angle: number): [number, number] => [
  cx + r * Math.cos(angle),
  cy + r * Math.sin(angle),
];
const poly = (points: readonly (readonly [number, number])[]): string =>
  points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

/** A tessellated square: four columns of connected, two-tone diagonal modules. */
export function triMosaic({ rng, outlier }: MotifContext): SVGElement[] {
  const n = 4;
  const step = AREA / n;
  const odd = outlier ? randInt(rng, 0, n * n - 1) : -1;
  const nodes: SVGElement[] = [];
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const x = INSET + col * step;
      const y = INSET + row * step;
      const i = row * n + col;
      nodes.push(
        svg('polygon', {
          points: poly([
            [x, y],
            [x + step, y],
            [x, y + step],
          ]),
          class: i === odd ? 'a3' : (row + col) % 2 === 0 ? 'a1' : 'a2',
        }),
      );
      if (row + col > 2)
        nodes.push(
          svg('polygon', {
            points: poly([
              [x + step, y],
              [x + step, y + step],
              [x, y + step],
            ]),
            class: (row + col) % 2 === 0 ? 'a2' : 'a1',
          }),
        );
    }
  }
  return nodes;
}

/** Two half-discs: line hatch on the left, a dot halftone that fades toward the right. */
export function halftoneHalves({ rng, outlier }: MotifContext): SVGElement[] {
  const cx = 50;
  const cy = 50;
  const r = 40;
  const nodes: SVGElement[] = [];
  const lines = 18;
  for (let i = 0; i < lines; i += 1) {
    const y = cy - r + ((i + 0.5) * (2 * r)) / lines;
    const half = Math.sqrt(r * r - (y - cy) ** 2);
    nodes.push(
      svg('line', { x1: cx - half, y1: y, x2: cx, y2: y, class: 'stroke-a1', 'stroke-width': 1 }),
    );
  }
  const step = 5;
  const accent = outlier ? randInt(rng, 0, 40) : -1;
  let k = 0;
  for (let x = cx + step / 2; x <= cx + r; x += step) {
    for (let y = cy - r; y <= cy + r; y += step) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r) continue;
      const t = 1 - (x - cx) / r;
      const rad = Math.max(0.4, t * (step * 0.5));
      nodes.push(svg('circle', { cx: x, cy: y, r: rad, class: k === accent ? 'a3' : 'a2' }));
      k += 1;
    }
  }
  return nodes;
}

/** Two substantial discs share one lens, like overlapping printing inks. */
export function overlap({ rng, outlier }: MotifContext): SVGElement[] {
  const spread = outlier ? randInt(rng, 11, 16) : 13;
  return [
    svg('circle', { cx: 50 - spread, cy: 50, r: 34, class: 'a1 blend' }),
    svg('circle', { cx: 50 + spread, cy: 50, r: 34, class: 'a2 blend' }),
  ];
}

/** Nine complete four-blade forms; a single turned glyph breaks the rhythm. */
export function pinwheels({ rng, outlier }: MotifContext): SVGElement[] {
  const n = 3;
  const step = AREA / n;
  const radius = step * 0.46;
  const odd = outlier ? randInt(rng, 0, n * n - 1) : -1;
  const nodes: SVGElement[] = [];
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const i = row * n + col;
      const cx = INSET + (col + 0.5) * step;
      const cy = INSET + (row + 0.5) * step;
      const base = i === odd ? Math.PI / 4 : 0;
      for (let blade = 0; blade < 4; blade += 1) {
        const a = base + (blade * TAU) / 4;
        nodes.push(
          svg('polygon', {
            points: poly([[cx, cy], polar(cx, cy, radius, a), polar(cx, cy, radius, a + TAU / 8)]),
            class: i === odd ? 'a2' : 'a1',
          }),
        );
      }
    }
  }
  return nodes;
}

/** Hexagons split into three rhombi, each in a different tone (the isometric "impossible" cube). */
export function impossibleHex({ rng, outlier }: MotifContext): SVGElement[] {
  const R = 11;
  const w = Math.sqrt(3) * R;
  const h = 1.5 * R;
  const odd = outlier ? randInt(rng, 0, 14) : -1;
  const nodes: SVGElement[] = [];
  let index = 0;
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const cx = INSET + R + col * w + (row % 2 === 1 ? w / 2 : 0);
      const cy = INSET + R + row * h;
      if (cx > 100 - INSET || cy > 100 - INSET) continue;
      const v = [0, 1, 2, 3, 4, 5].map((k) => polar(cx, cy, R, (Math.PI / 6) * (1 + 2 * k)));
      const rot = index === odd ? 1 : 0;
      // Three rhombi meet at the centre: centre + three consecutive vertices each.
      const faces: [number, number, number][] = [
        [0, 1, 2],
        [2, 3, 4],
        [4, 5, 0],
      ];
      faces.forEach(([a, b, c], face) => {
        const tone = ['a1', 'a2', 'a3'][(face + rot) % 3] ?? 'a1';
        const [pa, pb, pc] = [v[a], v[b], v[c]];
        if (!pa || !pb || !pc) return;
        nodes.push(svg('polygon', { points: poly([[cx, cy], pa, pb, pc]), class: tone }));
      });
      index += 1;
    }
  }
  return nodes;
}

/** A continuous four-lobed contour repeated at a measured interval. */
export function concentricKnot({ rng, outlier }: MotifContext): SVGElement[] {
  const accent = outlier ? randInt(rng, 2, 6) : -1;
  const contour =
    'M50 24 C20 -6 -6 20 24 50 C-6 80 20 106 50 76 C80 106 106 80 76 50 C106 20 80 -6 50 24 Z';
  return Array.from({ length: 9 }, (_, i) => {
    const scale = 1 - i * 0.082;
    return svg('path', {
      d: contour,
      class: i === accent ? 'ring ring-accent' : 'ring',
      transform: `translate(50 50) scale(${scale}) translate(-50 -50)`,
    });
  });
}

/** Three translucent triangles stacked and offset, ramped from art-1 to art-3. */
export function triStack({ rng, outlier }: MotifContext): SVGElement[] {
  const nodes: SVGElement[] = [];
  const shifts: [number, number][] = [
    [0, 0],
    [8, 10],
    [16, 20],
    [24, 30],
  ];
  shifts.forEach(([dx, dy], i) => {
    nodes.push(
      svg('polygon', {
        points: poly([
          [14 + dx, 86 - dy],
          [86 + dx * 0.4, 86 - dy],
          [50 + dx * 0.2, 14 - dy],
        ]),
        class: `glass t${i + 1}`,
      }),
    );
  });
  if (outlier) {
    const tilt = randInt(rng, 12, 22);
    nodes.push(
      svg('polygon', {
        points: poly([
          [70, 30],
          [92, 66],
          [60, 72],
        ]),
        class: 'glass a3',
        transform: `rotate(${tilt} 72 52)`,
      }),
    );
  }
  return nodes;
}

/** Nested orbital paths share one opening; one satellite marks the active loop. */
export function orbitRings({ rng, outlier }: MotifContext): SVGElement[] {
  const phase = randInt(rng, 0, 7) * 45;
  const active = outlier ? randInt(rng, 2, 5) : -1;
  const nodes: SVGElement[] = [];
  for (let i = 0; i < 7; i += 1) {
    const r = 11 + i * 5.4;
    const length = TAU * r;
    nodes.push(
      svg('circle', {
        cx: 50,
        cy: 50,
        r,
        class: 'ring',
        'stroke-dasharray': `${length * 0.83} ${length * 0.17}`,
        transform: `rotate(${phase + i * 8} 50 50)`,
      }),
    );
    if (i === active) {
      const [cx, cy] = polar(50, 50, r, ((phase + i * 8 - 30) * Math.PI) / 180);
      nodes.push(svg('circle', { cx, cy, r: 2.2, class: 'a2' }));
    }
  }
  return nodes;
}
