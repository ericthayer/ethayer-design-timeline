import type { PlaceholderMedia } from '../../content/types.ts';
import { svg } from '../../core/dom.ts';
import { mulberry32, randInt } from '../../core/rng.ts';

type Variant = PlaceholderMedia['variant'];

const line = (x1: number, y1: number, x2: number, y2: number): SVGElement =>
  svg('line', { x1, y1, x2, y2, class: 'ph-line' });
const box = (x: number, y: number, width: number, height: number, cls = 'ph-fill'): SVGElement =>
  svg('rect', { x, y, width, height, rx: 1.2, class: cls });

function site(rng: () => number): SVGElement[] {
  const cols = randInt(rng, 2, 4);
  const heroLeft = rng() < 0.5;
  const nodes: SVGElement[] = [
    svg('rect', { x: 2, y: 2, width: 156, height: 96, rx: 3, class: 'ph-frame' }),
    line(2, 11, 158, 11),
    ...[0, 1, 2].map((i) => svg('circle', { cx: 8 + i * 5, cy: 6.5, r: 1.4, class: 'ph-fill' })),
    box(10, 17, 22, 4),
    ...[0, 1, 2].map((i) => box(108 + i * 15, 17, 11, 4)),
    box(heroLeft ? 10 : 84, 28, 66, 30, 'ph-accent'),
    box(heroLeft ? 84 : 10, 31, 52, 6),
    box(heroLeft ? 84 : 10, 41, 40, 4),
    box(heroLeft ? 84 : 10, 49, 22, 6, 'ph-accent-2'),
  ];
  const w = (140 - (cols - 1) * 6) / cols;
  for (let i = 0; i < cols; i += 1) nodes.push(box(10 + i * (w + 6), 66, w, 24));
  return nodes;
}

function mobile(rng: () => number): SVGElement[] {
  const blocks = randInt(rng, 3, 4);
  const nodes: SVGElement[] = [
    svg('rect', { x: 50, y: 2, width: 60, height: 96, rx: 8, class: 'ph-frame' }),
    box(70, 6, 20, 3),
    box(56, 14, 48, 26, 'ph-accent'),
  ];
  for (let i = 0; i < blocks; i += 1) nodes.push(box(56, 46 + i * 12, 48 - (i % 2) * 14, 7));
  return nodes;
}

function video(): SVGElement[] {
  return [
    svg('rect', { x: 18, y: 8, width: 124, height: 72, rx: 3, class: 'ph-frame' }),
    svg('circle', { cx: 80, cy: 44, r: 13, class: 'ph-accent' }),
    svg('path', { d: 'M76 37.5 L87 44 L76 50.5 Z', class: 'ph-knock' }),
    line(18, 90, 142, 90),
    box(18, 88.5, 46, 3, 'ph-accent-2'),
  ];
}

function design(rng: () => number): SVGElement[] {
  const nodes: SVGElement[] = [
    svg('rect', { x: 2, y: 2, width: 156, height: 96, rx: 3, class: 'ph-frame' }),
    line(36, 2, 36, 98),
    ...[0, 1, 2, 3, 4, 5].map((i) => box(7, 9 + i * 8, 18 + (i % 3) * 3, 3)),
    box(46, 14, 44, 64, 'ph-fill'),
    box(50, 20, 36, 18, 'ph-accent'),
    box(98, 14, 50, 30, 'ph-fill'),
    box(98, 52, 22, 40, 'ph-fill'),
    box(126, 52, 22, randInt(rng, 18, 40), 'ph-accent-2'),
  ];
  return nodes;
}

/** Themed wireframe standing in for missing media (FR-036). Decorative. */
export function renderPlaceholder(variant: Variant, seed: number): SVGSVGElement {
  const rng = mulberry32(seed);
  const children =
    variant === 'site'
      ? site(rng)
      : variant === 'mobile'
        ? mobile(rng)
        : variant === 'video'
          ? video()
          : design(rng);
  return svg(
    'svg',
    {
      class: 'media__placeholder',
      viewBox: '0 0 160 100',
      preserveAspectRatio: 'xMidYMid meet',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    children,
  );
}
