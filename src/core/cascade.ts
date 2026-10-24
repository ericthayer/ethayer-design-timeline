/**
 * Triangle cascade for the hero art (spec 002, FR-104): a large triangle subdivided toward its
 * bottom-left corner, Sierpinski style. Each level emits its top, right, and inverted centre
 * facets, then recurses into the left facet, so the shapes shrink and warm toward one corner.
 */
export type Point = readonly [number, number];
export type Facet = 'base' | 'top' | 'right' | 'centre';

export interface Triangle {
  readonly points: readonly [Point, Point, Point];
  /** 0 is the outer triangle; deeper levels are smaller and warmer. */
  readonly level: number;
  readonly facet: Facet;
}

const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Apex, bottom-left, bottom-right → 1 + 4 × depth triangles, outermost first. */
export function cascade(apex: Point, left: Point, right: Point, depth: number): Triangle[] {
  const out: Triangle[] = [{ points: [apex, left, right], level: 0, facet: 'base' }];
  const b = left;
  let [a, c] = [apex, right];
  for (let level = 1; level <= depth; level += 1) {
    const ab = mid(a, b);
    const bc = mid(b, c);
    const ca = mid(c, a);
    out.push(
      { points: [a, ab, ca], level, facet: 'top' },
      { points: [ca, bc, c], level, facet: 'right' },
      { points: [ab, bc, ca], level, facet: 'centre' },
    );
    [a, c] = [ab, bc];
    out.push({ points: [a, b, c], level, facet: 'base' });
  }
  return out;
}

/** SVG `points` attribute, rounded to 2 decimals. */
export const toPoints = (points: readonly Point[]): string =>
  points.map(([x, y]) => `${String(+x.toFixed(2))},${String(+y.toFixed(2))}`).join(' ');
