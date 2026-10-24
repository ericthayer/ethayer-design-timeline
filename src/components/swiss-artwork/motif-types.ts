export interface MotifContext {
  readonly rng: () => number;
  readonly outlier: boolean;
}

/** Draws into a 100×100 viewBox. Colors come from classes (.a1–.a4, .bg, .t0–t4, .hair). */
export type MotifGenerator = (ctx: MotifContext) => SVGElement[];
