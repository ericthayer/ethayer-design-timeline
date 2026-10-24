/**
 * Renders one link-preview poster for Playwright to screenshot (FR-106):
 * /tools/og-card.html?slug=<project-slug | home>. It uses the real <swiss-artwork> component.
 * Sets <html data-ready> once fonts are loaded and the title has been fitted to its box.
 */
import '../src/styles/layers.css';
import '../src/styles/fonts.css';
import '../src/styles/tokens.css';
import './og-card.css';
import {
  define as defineArtwork,
  SwissArtwork,
} from '../src/components/swiss-artwork/swiss-artwork.ts';
import { HOME_OG_SLUG, homeOgCard, ogCardFor, type OgCard } from '../src/content/og.ts';
import { PROJECTS } from '../src/content/projects/index.ts';
import { el } from '../src/core/dom.ts';

const MAX_TITLE_PX = 120;
const MIN_TITLE_PX = 56;

function cardFor(slug: string | null): OgCard {
  if (slug === HOME_OG_SLUG) return homeOgCard();
  const project = PROJECTS.find((p) => p.slug === slug);
  if (!project) throw new Error(`No project with slug "${String(slug)}"`);
  return ogCardFor(project);
}

/** Largest size that keeps every word whole and the title inside its box. */
function fitTitle(title: HTMLElement, zone: HTMLElement): void {
  for (let size = MAX_TITLE_PX; size >= MIN_TITLE_PX; size -= 2) {
    title.style.setProperty('font-size', `${String(size)}px`);
    if (title.scrollWidth <= title.clientWidth && title.offsetHeight <= zone.clientHeight) return;
  }
}

function build(card: OgCard): { root: HTMLElement; title: HTMLElement; zone: HTMLElement } {
  defineArtwork();
  const art = new SwissArtwork();
  art.setAttribute('motif', card.motif);
  art.setAttribute('seed', String(card.seed));

  const title = el('h1', { class: 'og__title' }, [card.title]);
  const zone = el('div', { class: 'og__mid' }, [title]);
  const root = el(
    'article',
    { class: 'og', 'data-theme': card.theme, 'data-layout': card.layout },
    [
      el('div', { class: 'og__type' }, [
        el('header', { class: 'og__head' }, [
          el('p', { class: 'og__kicker' }, [card.kicker]),
          el('p', { class: 'og__index' }, [
            el('span', {}, [card.numerals[0]]),
            el('span', {}, [card.numerals[1]]),
          ]),
        ]),
        zone,
        el('footer', { class: 'og__foot' }, [
          el('p', { class: 'og__year' }, [card.year]),
          el(
            'ul',
            { class: 'og__tracks' },
            card.tracks.map((track) => el('li', {}, [track])),
          ),
        ]),
      ]),
      el('div', { class: 'og__art' }, [art]),
    ],
  );
  return { root, title, zone };
}

const { root, title, zone } = build(cardFor(new URLSearchParams(location.search).get('slug')));
document.body.replaceChildren(root);
await document.fonts.load('700 30px "Hanken Grotesk"');
await document.fonts.ready;
fitTitle(title, zone);
document.documentElement.dataset['ready'] = 'true';
