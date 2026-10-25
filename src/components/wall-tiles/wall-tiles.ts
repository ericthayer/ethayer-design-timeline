import type { Era } from '../../content/types.ts';
import { SITE } from '../../content/site.ts';
import { el } from '../../core/dom.ts';
import { indexNumerals, periodText } from '../../core/format.ts';
import { renderPicture } from '../card-media/image.ts';
import './wall-tiles.css';

const PORTRAIT_SRC = 'site/portrait';
const PORTRAIT_ALT =
  'Eric Thayer smiling on a boat in a black-and-white photo, wearing a San Francisco Giants cap, sunglasses, and a dark zip-up jacket.';
/** The portrait fills the right half of a feature tile: one cell wide (FR-030 cells). */
const PORTRAIT_SIZES =
  '(min-width: 1801px) 34vh, (min-width: 1500px) 17vw, (min-width: 1200px) 20vw, (min-width: 900px) 25vw, (min-width: 600px) 33vw, 50vw';

function numerals(period: Era['period']): HTMLElement {
  const [first, second] = indexNumerals(period);
  return el('p', { class: 'tile__index' }, [
    el('span', { 'aria-hidden': 'true' }, [first]),
    el('span', { 'aria-hidden': 'true' }, [second]),
    el('span', { class: 'visually-hidden' }, [periodText(period)]),
  ]);
}

/** Chapter marker at the start of each era (US1). */
export function renderEra(era: Era): HTMLElement {
  return el('section', { class: 'tile tile--era', 'aria-labelledby': `era-${era.id}` }, [
    numerals(era.period),
    el('h2', { class: 'tile__era-label', id: `era-${era.id}` }, [era.label]),
  ]);
}

function educationList(): HTMLElement {
  return el(
    'ul',
    { class: 'tile__education' },
    SITE.education.map((item) =>
      el('li', {}, [
        el('span', { class: 'tile__year' }, [item.year]),
        el('span', {}, [item.degree]),
        el('span', { class: 'tile__school' }, [item.school]),
      ]),
    ),
  );
}

/** Education tile near the start of the wall (FR-074). */
export function renderEducation(): HTMLElement {
  return el(
    'section',
    {
      class: 'tile tile--end tile--education',
      'data-theme': 'paper-vermilion',
      'aria-labelledby': 'timeline-education',
    },
    [el('h2', { class: 'tile__title', id: 'timeline-education' }, ['Education']), educationList()],
  );
}

/** End-cap: contact card with Eric's portrait that closes the timeline (FR-072). */
export function renderEndCap(): HTMLElement {
  const portrait = renderPicture(
    { kind: 'image', src: PORTRAIT_SRC, alt: PORTRAIT_ALT, focal: '50% 0%' },
    { sizes: PORTRAIT_SIZES, className: 'tile__portrait' },
  );
  return el(
    'section',
    { class: 'tile tile--end tile--contact', 'aria-labelledby': 'timeline-end' },
    [
      el('div', { class: 'tile__panel', 'data-theme': 'paper-vermilion' }, [
        el('h2', { class: 'tile__title', id: 'timeline-end', tabindex: '-1' }, [
          'End of the timeline',
        ]),
        el('p', { class: 'tile__cta' }, ['Start of the timeline. Let’s talk about what’s next.']),
        el(
          'ul',
          { class: 'tile__links', 'aria-label': 'Contact' },
          SITE.links
            .filter((link) => link.label === 'Résumé' || link.label === 'Email')
            .map((link) => el('li', {}, [el('a', { href: link.href }, [link.label])])),
        ),
      ]),
      portrait,
    ],
  );
}
