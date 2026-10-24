import { ERAS } from '../../content/eras.ts';
import { SITE } from '../../content/site.ts';
import { cascade, toPoints } from '../../core/cascade.ts';
import { el, svg } from '../../core/dom.ts';
import { indexNumerals, periodText } from '../../core/format.ts';
import './site-hero.css';

const CASCADE_DEPTH = 5;

/** Decorative triangle cascade (FR-104). Colors and stagger come from CSS. */
export function renderHeroArt(): SVGSVGElement {
  const triangles = cascade([78, 0], [8, 100], [148, 100], CASCADE_DEPTH);
  return svg(
    'svg',
    {
      class: 'site-hero__art',
      viewBox: '0 0 150 100',
      preserveAspectRatio: 'xMaxYMax meet',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    triangles.map((t, i) => {
      const polygon = svg('polygon', {
        points: toPoints(t.points),
        'data-level': t.level,
        'data-facet': t.facet,
      });
      polygon.style.setProperty('--i', String(i));
      return polygon;
    }),
  );
}

function column(label: string, children: readonly (Node | string)[]): HTMLElement {
  return el('div', { class: 'site-hero__col' }, [
    el('p', { class: 'site-hero__label' }, [label]),
    ...children,
  ]);
}

/** The CTA: an in-page link to the wall (FR-103). main.ts adds the scroll and focus handoff. */
function cta(): HTMLAnchorElement {
  return el('a', { class: 'site-hero__cta', href: '#wall' }, [
    el('span', {}, ['Explore the timeline']),
    el('span', { class: 'site-hero__cta-icon', 'aria-hidden': 'true' }, [
      svg('svg', { viewBox: '0 0 16 16', focusable: 'false' }, [
        svg('path', { d: 'M8 2.5v11M3.5 9 8 13.5 12.5 9' }),
      ]),
    ]),
  ]);
}

/** Full-viewport hero (FR-100–FR-102). Holds the page's h1. */
export function renderHero(projectCount: number): HTMLElement {
  const [first, second] = indexNumerals(SITE.span);
  const now = ERAS[0];
  return el(
    'section',
    { class: 'site-hero', 'data-theme': 'plum-ember', 'aria-labelledby': 'site-name' },
    [
      renderHeroArt(),
      el('header', { class: 'site-hero__head' }, [
        el('p', { class: 'site-hero__role' }, [SITE.role, el('br'), SITE.location]),
        el('p', { class: 'site-hero__index' }, [
          el('span', { 'aria-hidden': 'true' }, [first]),
          el('span', { 'aria-hidden': 'true' }, [second]),
          el('span', { class: 'visually-hidden' }, [periodText(SITE.span)]),
        ]),
      ]),
      el('div', { class: 'site-hero__title-block' }, [
        el('p', { class: 'site-hero__eyebrow' }, [
          `Career timeline · ${String(projectCount)} projects`,
        ]),
        el('h1', { class: 'site-hero__name', id: 'site-name', tabindex: '-1' }, [SITE.name]),
      ]),
      el('p', { class: 'site-hero__span' }, [`${SITE.span.start.slice(0, 4)}—Now`]),
      el('footer', { class: 'site-hero__foot' }, [
        column('About', [el('p', {}, [SITE.summary])]),
        column('Now', [el('p', {}, [`${now.label}, since ${now.period.start.slice(0, 4)}.`])]),
        column('Elsewhere', [
          el(
            'ul',
            { class: 'site-hero__links' },
            SITE.links.map((link) => el('li', {}, [el('a', { href: link.href }, [link.label])])),
          ),
        ]),
        el('div', { class: 'site-hero__col site-hero__col--cta' }, [cta()]),
      ]),
    ],
  );
}
