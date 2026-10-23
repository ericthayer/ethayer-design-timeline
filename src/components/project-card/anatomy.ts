import type { Project } from '../../content/types.ts';
import { cloneTemplate, el, makeTemplate, qs } from '../../core/dom.ts';
import { indexNumerals, periodText, yearRange } from '../../core/format.ts';

/** Swiss poster skeleton (FR-011). Tiers hide parts in CSS; DOM order is head, title, art, foot. */
const swissTemplate = makeTemplate(() => [
  el('article', { class: 'card card--swiss', 'data-treatment': 'swiss' }, [
    el('header', { class: 'poster__head' }, [
      el('p', { class: 'poster__client', 'data-slot': 'client' }),
      el('p', { class: 'poster__index' }, [
        el('span', { 'aria-hidden': 'true', 'data-slot': 'i1' }),
        el('span', { 'aria-hidden': 'true', 'data-slot': 'i2' }),
        el('span', { class: 'visually-hidden', 'data-slot': 'period' }),
      ]),
    ]),
    el('h3', { class: 'poster__title', 'data-slot': 'heading' }, [
      el('a', { class: 'card__link', 'data-slot': 'link' }),
    ]),
    el('div', { class: 'poster__art', 'data-slot': 'art' }),
    el('footer', { class: 'poster__foot' }, [
      el('p', { class: 'poster__year', 'aria-hidden': 'true', 'data-slot': 'year' }),
      el('ul', { class: 'poster__tracks', 'aria-label': 'Highlights', 'data-slot': 'tracks' }),
    ]),
  ]),
]);

/** Standard media tile (FR-011a): label first in DOM so screen readers hear the title first. */
const standardTemplate = makeTemplate(() => [
  el('article', { class: 'card card--standard', 'data-treatment': 'standard' }, [
    el('div', { class: 'card__label' }, [
      el('h3', { class: 'card__title', 'data-slot': 'heading' }, [
        el('a', { class: 'card__link', 'data-slot': 'link' }),
      ]),
      el('p', { class: 'card__meta' }, [
        el('span', { 'data-slot': 'client' }),
        el('span', { 'aria-hidden': 'true' }, [' · ']),
        el('span', { 'data-slot': 'year' }),
      ]),
    ]),
    el('div', { class: 'card__media', 'data-slot': 'art' }),
  ]),
]);

export interface Anatomy {
  readonly article: HTMLElement;
  readonly art: HTMLElement;
}

const titleId = (slug: string): string => `card-title-${slug}`;

function fillCommon(fragment: DocumentFragment, project: Project): Anatomy {
  const article = qs(fragment, 'article');
  article.dataset['theme'] = project.theme;
  article.dataset['size'] = project.size;
  article.dataset['layout'] = project.layout;
  article.setAttribute('aria-labelledby', titleId(project.slug));
  qs(fragment, '[data-slot="heading"]').id = titleId(project.slug);
  const link = qs(fragment, '[data-slot="link"]', HTMLAnchorElement);
  link.href = `/work/${project.slug}`;
  link.textContent = project.title;
  link.dataset['slug'] = project.slug;
  link.setAttribute('aria-haspopup', 'dialog');
  qs(fragment, '[data-slot="client"]').textContent = project.client;
  return { article, art: qs(fragment, '[data-slot="art"]') };
}

export function buildSwiss(project: Project): Anatomy {
  const fragment = cloneTemplate(swissTemplate());
  const anatomy = fillCommon(fragment, project);
  const [first, second] = indexNumerals(project.period);
  qs(fragment, '[data-slot="i1"]').textContent = first;
  qs(fragment, '[data-slot="i2"]').textContent = second;
  qs(fragment, '[data-slot="period"]').textContent = periodText(project.period);
  qs(fragment, '[data-slot="year"]').textContent = yearRange(project.period);
  const tracks = qs(fragment, '[data-slot="tracks"]');
  for (const track of project.tracklist.slice(0, project.size === 'feature' ? 8 : 6)) {
    tracks.append(
      el('li', {}, [
        el('span', {}, [track.label]),
        ...(track.value ? [el('span', { class: 'poster__value' }, [track.value])] : []),
      ]),
    );
  }
  return anatomy;
}

export function buildStandard(project: Project): Anatomy {
  const fragment = cloneTemplate(standardTemplate());
  const anatomy = fillCommon(fragment, project);
  qs(fragment, '[data-slot="year"]').textContent = yearRange(project.period);
  return anatomy;
}
