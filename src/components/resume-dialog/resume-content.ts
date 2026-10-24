import type { Resume, ResumeIntro, ResumeRole } from '../../content/types.ts';
import { SITE } from '../../content/site.ts';
import { el } from '../../core/dom.ts';
import { periodText, yearRange } from '../../core/format.ts';
import { imageUrl } from '../card-media/image.ts';
import { renderHeroArt } from '../site-hero/site-hero.ts';

const external = (href: string, label: string): HTMLAnchorElement =>
  el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, [
    label,
    el('span', { 'aria-hidden': 'true' }, [' ↗']),
    el('span', { class: 'visually-hidden' }, [' (opens in a new tab)']),
  ]);

export function buildBar(): HTMLElement {
  return el('div', { class: 'rd__bar' }, [
    el('p', { class: 'rd__bar-title' }, [`${SITE.name} · Résumé`]),
    el('button', { type: 'button', class: 'rd__btn', 'data-print': '' }, ['Print / Save PDF']),
    el('button', { type: 'button', class: 'rd__btn rd__close', 'data-close': '' }, [
      el('span', { 'aria-hidden': 'true' }, ['✕']),
      ' Close',
    ]),
  ]);
}

/** FR-121: the intro video never autoplays; without one, the hero art holds the slot. */
function introSlot(intro: ResumeIntro | undefined): HTMLElement {
  if (!intro) {
    return el('div', { class: 'rd__intro rd__intro--art', 'aria-hidden': 'true' }, [
      renderHeroArt(),
    ]);
  }
  return el('figure', { class: 'rd__intro' }, [
    el(
      'video',
      {
        controls: true,
        playsinline: true,
        preload: 'none',
        poster: imageUrl(intro.poster.src, 'webp', 1440),
        'aria-label': intro.title,
      },
      [
        el('source', { src: `/media/${intro.src}.webm`, type: 'video/webm' }),
        el('source', { src: `/media/${intro.src}.mp4`, type: 'video/mp4' }),
        el('track', {
          kind: 'captions',
          src: intro.captions,
          srclang: 'en',
          label: 'English',
          default: true,
        }),
      ],
    ),
    el('figcaption', {}, [intro.title]),
  ]);
}

function masthead(resume: Resume, title: HTMLElement): HTMLElement {
  return el('header', { class: 'rd__masthead', 'data-theme': 'plum-ember' }, [
    el('div', { class: 'rd__id' }, [
      el('p', { class: 'rd__eyebrow' }, [`${SITE.role} · ${SITE.location}`]),
      title,
      el('p', { class: 'rd__headline' }, [resume.headline]),
      el('p', { class: 'rd__summary' }, [resume.summary]),
      el(
        'ul',
        { class: 'rd__contact', 'aria-label': 'Contact and profiles' },
        SITE.links
          .filter((link) => link.href.startsWith('https:') || link.href.startsWith('mailto:'))
          .map((link) =>
            el('li', {}, [
              link.href.startsWith('https:')
                ? external(link.href, link.label)
                : el('a', { href: link.href }, [link.label]),
            ]),
          ),
      ),
    ]),
    introSlot(resume.intro),
  ]);
}

function role(item: ResumeRole): HTMLElement {
  return el('li', { class: 'rd__role' }, [
    el('p', { class: 'rd__when' }, [
      el('span', { 'aria-hidden': 'true' }, [yearRange(item.period)]),
      el('span', { class: 'visually-hidden' }, [periodText(item.period)]),
    ]),
    el('div', {}, [
      el('h4', { class: 'rd__role-title' }, [item.role]),
      el('p', { class: 'rd__company' }, [
        item.href ? external(item.href, item.company) : item.company,
        ` · ${item.location}`,
      ]),
      el('p', { class: 'rd__role-summary' }, [item.summary]),
      el(
        'ul',
        { class: 'rd__highlights' },
        item.highlights.map((h) => el('li', {}, [h])),
      ),
    ]),
  ]);
}

function list(heading: string, items: readonly string[]): HTMLElement {
  return el('section', { class: 'rd__side-block' }, [
    el('h3', {}, [heading]),
    el(
      'ul',
      { class: 'rd__tags' },
      items.map((item) => el('li', {}, [item])),
    ),
  ]);
}

export function buildDocument(resume: Resume): { body: HTMLElement; title: HTMLElement } {
  const title = el('h2', { class: 'rd__name', id: 'rd-title', tabindex: '-1' }, [SITE.name]);
  const experience = el('section', { class: 'rd__main', 'aria-labelledby': 'rd-experience' }, [
    el('h3', { id: 'rd-experience' }, ['Experience']),
    el('ol', { class: 'rd__roles' }, resume.experience.map(role)),
  ]);
  const side = el('aside', { class: 'rd__side', 'aria-label': 'Skills and education' }, [
    list('Skills', resume.skills),
    list('Development', resume.proficiencies.development),
    list('Software', resume.proficiencies.software),
    el('section', { class: 'rd__side-block' }, [
      el('h3', {}, ['Education']),
      el(
        'ul',
        { class: 'rd__plain' },
        SITE.education.map((e) =>
          el('li', {}, [el('strong', {}, [e.degree]), el('span', {}, [`${e.school} · ${e.year}`])]),
        ),
      ),
    ]),
    el('section', { class: 'rd__side-block' }, [
      el('h3', {}, ['Selected projects']),
      el(
        'ul',
        { class: 'rd__plain' },
        resume.projects.map((p) =>
          el('li', {}, [
            el('strong', {}, [p.href ? external(p.href, p.title) : p.title]),
            el('span', {}, [`${p.detail} · ${p.year}`]),
          ]),
        ),
      ),
    ]),
  ]);
  const body = el('div', { class: 'rd__body' }, [
    masthead(resume, title),
    el('div', { class: 'rd__columns' }, [experience, side]),
  ]);
  return { body, title };
}
