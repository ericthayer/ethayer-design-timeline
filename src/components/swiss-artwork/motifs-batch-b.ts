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

/** Triangles tessellated on a grid, keeping only those inside a chamfered square. */
export function triMosaic({ rng, outlier }: MotifContext): SVGElement[] {
  const n = 6;
  const s = AREA / n;
  const inside = ([x, y]: readonly [number, number]): boolean => {
    const dx = Math.abs(x - 50);
    const dy = Math.abs(y - 50);
    return dx <= 42 && dy <= 42 && dx + dy <= 62;
  };
  const cells: SVGElement[] = [];
  const candidates: number[] = [];
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const x = INSET + col * s;
      const y = INSET + row * s;
      const up = (row + col) % 2 === 0;
      const pts: [number, number][] = up
        ? [
            [x, y + s],
            [x + s, y + s],
            [x + s / 2, y],
          ]
        : [
            [x, y],
            [x + s, y],
            [x + s / 2, y + s],
          ];
      const [p0, p1, p2] = pts as [[number, number], [number, number], [number, number]];
      const centroid: [number, number] = [(p0[0] + p1[0] + p2[0]) / 3, (p0[1] + p1[1] + p2[1]) / 3];
      if (!inside(centroid)) continue;
      candidates.push(cells.length);
      cells.push(svg('polygon', { points: poly(pts), class: rng() < 0.5 ? 'a1' : 'a2' }));
    }
  }
  if (outlier && candidates.length > 0) {
    const pick = cells[randInt(rng, 0, cells.length - 1)];
    pick?.setAttribute('class', 'a3');
  }
  return cells;
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

/** Two multiply-blended discs; the outlier is a bg-colored counter-form in the overlap. */
export function overlap({ rng, outlier }: MotifContext): SVGElement[] {
  const spread = randInt(rng, 4, 22);
  const nodes: SVGElement[] = [
    svg('circle', { cx: 50 - spread, cy: 50, r: 26, class: 'a1 blend' }),
    svg('circle', { cx: 50 + spread, cy: 50, r: 26, class: 'a2 blend' }),
  ];
  if (outlier) nodes.push(svg('circle', { cx: 50, cy: 50, r: 6, class: 'bg' }));
  return nodes;
}

/** Four-blade glyphs on a staggered grid; odd rows turn the other way. */
export function pinwheels({ rng, outlier }: MotifContext): SVGElement[] {
  const n = 4;
  const step = AREA / n;
  const radius = step * 0.56;
  const odd = outlier ? randInt(rng, 0, n * n - 1) : -1;
  const nodes: SVGElement[] = [];
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const i = row * n + col;
      const cx = INSET + col * step + step / 2 + (row % 2 === 1 ? step / 2 : 0);
      const cy = INSET + row * step + step / 2;
      const turn = row % 2 === 0 ? 1 : -1;
      const base = i === odd ? Math.PI / 6 : 0;
      for (let blade = 0; blade < 4; blade += 1) {
        const a = base + turn * (blade * (TAU / 4));
        const tip = polar(cx, cy, radius, a);
        const side = polar(cx, cy, radius * 0.62, a + turn * (TAU / 8));
        nodes.push(
          svg('polygon', {
            points: poly([[cx, cy], side, tip]),
            class: i === odd ? 'a3' : 'a1',
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

/** Concentric rings, each broken by a seeded gap; the outlier ring is accented and off-centre. */
export function concentricKnot({ rng, outlier }: MotifContext): SVGElement[] {
  const rings = 9;
  const accent = outlier ? randInt(rng, 2, rings - 3) : -1;
  const nodes: SVGElement[] = [];
  for (let i = 0; i < rings; i += 1) {
    const r = 8 + i * 4.2;
    const c = 2 * Math.PI * r;
    const gap = c * (0.12 + rng() * 0.2);
    const offset = rng() * c;
    nodes.push(
      svg('circle', {
        cx: 50 + (i === accent ? 3 : 0),
        cy: 50,
        r,
        class: i === accent ? 'ring ring-accent' : 'ring',
        'stroke-dasharray': `${(c - gap).toFixed(2)} ${gap.toFixed(2)}`,
        'stroke-dashoffset': offset.toFixed(2),
      }),
    );
  }
  return nodes;
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

/** Concentric arcs of dashes at seeded phases, with one dot in accent on an orbit. */
export function orbitRings({ rng, outlier }: MotifContext): SVGElement[] {
  const rings = 6;
  const accent = outlier ? randInt(rng, 1, rings - 2) : -1;
  const nodes: SVGElement[] = [svg('circle', { cx: 50, cy: 50, r: 4, class: 'a1' })];
  for (let i = 0; i < rings; i += 1) {
    const r = 12 + i * 6.4;
    const c = 2 * Math.PI * r;
    const dash = c / (5 + i);
    nodes.push(
      svg('circle', {
        cx: 50,
        cy: 50,
        r,
        class: 'ring',
        'stroke-dasharray': `${dash.toFixed(2)} ${dash.toFixed(2)}`,
        'stroke-dashoffset': (rng() * c).toFixed(2),
      }),
    );
    if (i === accent) {
      const [x, y] = polar(50, 50, r, rng() * TAU);
      nodes.push(svg('circle', { cx: x, cy: y, r: 2.6, class: 'a3' }));
    }
  }
  return nodes;
}
