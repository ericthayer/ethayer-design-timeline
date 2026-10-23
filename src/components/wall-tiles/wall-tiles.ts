import type { Era } from '../../content/types.ts';
import { SITE } from '../../content/site.ts';
import { el } from '../../core/dom.ts';
import { indexNumerals, periodText } from '../../core/format.ts';
import { SwissArtwork } from '../swiss-artwork/swiss-artwork.ts';
import './wall-tiles.css';

function numerals(period: Era['period']): HTMLElement {
  const [first, second] = indexNumerals(period);
  return el('p', { class: 'tile__index' }, [
    el('span', { 'aria-hidden': 'true' }, [first]),
    el('span', { 'aria-hidden': 'true' }, [second]),
    el('span', { class: 'visually-hidden' }, [periodText(period)]),
  ]);
}

/** Identity poster: the first grid item (FR-008). Holds the page's h1. */
export function renderIdentity(): HTMLElement {
  const art = new SwissArtwork();
  art.setAttribute('motif', 'tone-dots');
  art.setAttribute('seed', '2003');
  return el('article', { class: 'tile tile--identity', 'data-theme': 'paper-vermilion' }, [
    el('header', { class: 'tile__head' }, [el('p', {}, [SITE.role]), numerals(SITE.span)]),
    el('h1', { class: 'tile__title' }, [SITE.name]),
    el('div', { class: 'tile__art' }, [art]),
    el('footer', { class: 'tile__foot' }, [
      el('p', { class: 'tile__summary' }, [`${SITE.summary} ${SITE.location}.`]),
      el(
        'ul',
        { class: 'tile__links', 'aria-label': 'Contact and profiles' },
        SITE.links.map((link) => el('li', {}, [el('a', { href: link.href }, [link.label])])),
      ),
    ]),
  ]);
}

/** Chapter marker at the start of each era (US1). */
export function renderEra(era: Era): HTMLElement {
  return el('section', { class: 'tile tile--era', 'aria-labelledby': `era-${era.id}` }, [
    numerals(era.period),
    el('h2', { class: 'tile__era-label', id: `era-${era.id}` }, [era.label]),
  ]);
}

/** End-cap closes the timeline (FR-072). */
export function renderEndCap(): HTMLElement {
  return el(
    'section',
    { class: 'tile tile--end', 'data-theme': 'paper-vermilion', 'aria-labelledby': 'timeline-end' },
    [
      el('h2', { class: 'tile__title', id: 'timeline-end', tabindex: '-1' }, ['Education']),
      el(
        'ul',
        { class: 'tile__education' },
        SITE.education.map((item) =>
          el('li', {}, [
            el('span', { class: 'tile__year' }, [item.year]),
            el('span', {}, [item.degree]),
            el('span', { class: 'tile__school' }, [item.school]),
          ]),
        ),
      ),
      el('p', { class: 'tile__cta' }, ['Start of the timeline. Let’s talk about what’s next.']),
      el(
        'ul',
        { class: 'tile__links', 'aria-label': 'Contact' },
        SITE.links
          .filter((link) => link.label === 'Résumé' || link.label === 'Email')
          .map((link) => el('li', {}, [el('a', { href: link.href }, [link.label])])),
      ),
    ],
  );
}
