import { MOTIFS } from '../../content/motifs.ts';
import type { MotifName } from '../../content/types.ts';
import { defineOnce, svg } from '../../core/dom.ts';
import { mulberry32 } from '../../core/rng.ts';
import type { MotifGenerator } from './motif-types.ts';
import { diagonalLines, eclipse, horizonLines, nestedSquares } from './motifs-form.ts';
import { dotGridMark, driftBars, petals, scatter, toneDots } from './motifs-grid.ts';
import './swiss-artwork.css';

export const MOTIF_REGISTRY: Readonly<Record<MotifName, MotifGenerator>> = {
  petals,
  eclipse,
  'drift-bars': driftBars,
  scatter,
  'tone-dots': toneDots,
  'dot-grid-mark': dotGridMark,
  'diagonal-lines': diagonalLines,
  'nested-squares': nestedSquares,
  'horizon-lines': horizonLines,
};

/** Field motifs crop to fill (slice); lattice motifs stay whole and align left (meet). */
const CROPS: ReadonlySet<MotifName> = new Set(['eclipse', 'diagonal-lines', 'nested-squares']);

export const isMotif = (value: string | null): value is MotifName =>
  MOTIFS.some((motif) => motif === value);

/** Pure renderer (FR-040): same motif, seed, and outlier flag give identical SVG. */
export function renderArtwork(motif: MotifName, seed: number, outlier = true): SVGSVGElement {
  const rng = mulberry32(seed);
  return svg(
    'svg',
    {
      class: 'swiss-art',
      viewBox: '0 0 100 100',
      preserveAspectRatio: CROPS.has(motif) ? 'xMidYMid slice' : 'xMinYMid meet',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    [
      svg('rect', { class: 'bg', width: 100, height: 100 }),
      ...MOTIF_REGISTRY[motif]({ rng, outlier }),
    ],
  );
}

/** <swiss-artwork motif="petals" seed="42" outlier="false">. Decorative; colors from [data-theme]. */
export class SwissArtwork extends HTMLElement {
  static readonly observedAttributes = ['motif', 'seed', 'outlier'];

  connectedCallback(): void {
    this.setAttribute('aria-hidden', 'true');
    this.render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  private render(): void {
    const motif = this.getAttribute('motif');
    if (!isMotif(motif)) {
      this.replaceChildren();
      return;
    }
    const seed = Number(this.getAttribute('seed') ?? '0') || 0;
    this.replaceChildren(renderArtwork(motif, seed, this.getAttribute('outlier') !== 'false'));
  }
}

export function define(): void {
  defineOnce('swiss-artwork', SwissArtwork);
}
