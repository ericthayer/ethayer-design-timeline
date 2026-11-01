import type { Category } from '../../content/categories.ts';
import type { Era } from '../../content/types.ts';
import { SITE } from '../../content/site.ts';
import { el } from '../../core/dom.ts';
import { indexNumerals, pad2, periodText } from '../../core/format.ts';
import './wall-tiles.css';

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

/** Section marker on the Projects view: era-marker styles, project count for numerals (spec 006, FR-511). */
export function renderCategory(category: Category, count: number): HTMLElement {
  const id = `category-${category.id}`;
  return el('section', { class: 'tile tile--era tile--category', 'aria-labelledby': id }, [
    el('p', { class: 'tile__index' }, [
      el('span', { 'aria-hidden': 'true' }, [pad2(count)]),
      el('span', { class: 'visually-hidden' }, [`${String(count)} projects`]),
    ]),
    el('h2', { class: 'tile__era-label', id }, [category.label]),
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
