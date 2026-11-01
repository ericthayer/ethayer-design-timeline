import { SITE } from '../../content/site.ts';
import { el } from '../../core/dom.ts';
import { renderPicture } from '../card-media/image.ts';
import './site-footer.css';

/** Placeholder until the owner uploads the final photo to media-src/site/portrait.png (Q3). */
const PORTRAIT_ALT = 'Placeholder for a portrait of Eric Thayer.';
const PORTRAIT_SIZES = '(min-width: 900px) 40vw, 100vw';
const LINKS = new Set(['Résumé', 'LinkedIn', 'GitHub', 'Email']);

/** Contact band after <main> on both views (spec 006, FR-540–FR-542). */
export function renderFooter(): HTMLElement {
  return el('footer', { class: 'site-footer', 'aria-labelledby': 'site-footer-title' }, [
    el('div', { class: 'site-footer__panel', 'data-theme': 'paper-vermilion' }, [
      el('h2', { class: 'site-footer__title', id: 'site-footer-title' }, ['Let’s talk']),
      el('p', { class: 'site-footer__copy' }, [
        `I build design systems and the agentic tooling around them, from ${SITE.location}. If you’re hiring, or you have a design-to-code problem worth solving, I’d like to hear about it.`,
      ]),
      el(
        'ul',
        { class: 'site-footer__links', 'aria-label': 'Contact' },
        SITE.links
          .filter((link) => LINKS.has(link.label))
          .map((link) => el('li', {}, [el('a', { href: link.href }, [link.label])])),
      ),
    ]),
    renderPicture(
      { kind: 'image', src: 'site/portrait', alt: PORTRAIT_ALT, focal: '50% 30%' },
      { sizes: PORTRAIT_SIZES, className: 'site-footer__portrait' },
    ),
  ]);
}
