import type { Era, Project } from '../../content/types.ts';
import { el } from '../../core/dom.ts';
import { indexNumerals, pad2, periodText, yearRange } from '../../core/format.ts';
import { renderArtworkElement, seedOf } from '../card-media/card-media.ts';
import { renderDialogFrame } from '../card-media/iframe.ts';
import { renderPicture } from '../card-media/image.ts';
import { renderPlaceholder } from '../card-media/placeholder.ts';
import { renderDialogVideo } from '../card-media/video.ts';
import { buildGallery } from './dialog-gallery.ts';

export interface DialogView {
  readonly project: Project;
  readonly index: number;
  readonly total: number;
  readonly era: Era | undefined;
  readonly prev: Project | undefined;
  readonly next: Project | undefined;
}

const ENGAGEMENT: Readonly<Record<Project['engagement'], string>> = {
  'full-time': 'Full-time',
  contract: 'Contract',
  freelance: 'Freelance',
  personal: 'Personal study',
  education: 'Education',
};

function navButton(dir: -1 | 1, target: Project | undefined): HTMLButtonElement {
  const label = dir === -1 ? 'Previous' : 'Next';
  const button = el(
    'button',
    {
      type: 'button',
      class: 'pd__btn',
      'data-dir': dir,
      disabled: !target,
      'aria-label': target ? `${label}: ${target.title}` : label,
    },
    dir === -1
      ? [el('span', { 'aria-hidden': 'true' }, ['←']), ` ${label}`]
      : [`${label} `, el('span', { 'aria-hidden': 'true' }, ['→'])],
  );
  return button;
}

export function buildBar(view: DialogView): HTMLElement {
  const era = view.era;
  return el('div', { class: 'pd__bar' }, [
    navButton(-1, view.prev),
    el('p', { class: 'pd__counter' }, [
      el('span', { class: 'pd__count' }, [`${pad2(view.index)} / ${pad2(view.total)}`]),
      ...(era ? [el('span', { class: 'pd__era' }, [era.label])] : []),
    ]),
    navButton(1, view.next),
    el('button', { type: 'button', class: 'pd__btn pd__close', 'data-close': '' }, [
      el('span', { 'aria-hidden': 'true' }, ['✕']),
      ' Close',
    ]),
  ]);
}

/** Hero media is interactive in the dialog (FR-052). */
export function buildHero(project: Project): HTMLElement {
  const media = project.media;
  const hero = el('div', {
    class: 'pd__hero',
    'data-theme': project.theme,
    'data-kind': media.kind,
  });
  switch (media.kind) {
    case 'artwork':
      hero.append(renderArtworkElement(project));
      break;
    case 'placeholder':
      hero.append(renderPlaceholder(media.variant, seedOf(project)));
      break;
    case 'image':
      hero.append(
        renderPicture(media, {
          sizes: '(min-width: 900px) 58vw, 100vw',
          eager: true,
          className: 'hero__picture',
        }),
      );
      break;
    case 'video':
      hero.append(renderDialogVideo(media));
      break;
    case 'iframe': {
      // The poster shows until the live site loads (or if it never does).
      const frame = renderDialogFrame(media);
      frame.addEventListener('load', () => {
        hero.dataset['loaded'] = '';
      });
      hero.append(
        renderPicture(media.poster, {
          sizes: '(min-width: 900px) 58vw, 100vw',
          eager: true,
          className: 'hero__picture',
        }),
        frame,
      );
      break;
    }
  }
  return hero;
}

function links(project: Project): HTMLElement[] {
  if (!project.links?.length) return [];
  return [
    el(
      'ul',
      { class: 'pd__links', 'aria-label': 'Project links' },
      project.links.map((link) =>
        el('li', {}, [
          el('a', { href: link.href, target: '_blank', rel: 'noopener noreferrer' }, [
            link.label,
            el('span', { 'aria-hidden': 'true' }, [' ↗']),
            el('span', { class: 'visually-hidden' }, [' (opens in a new tab)']),
          ]),
        ]),
      ),
    ),
  ];
}

export function buildBody(
  view: DialogView,
  hero: HTMLElement,
): { body: HTMLElement; title: HTMLElement } {
  const { project } = view;
  const [first, second] = indexNumerals(project.period);
  const title = el('h2', { class: 'pd__title', id: 'pd-title', tabindex: '-1' }, [project.title]);
  const facts: [string, string][] = [
    ['Role', project.role],
    ['Period', yearRange(project.period)],
    ['Type', ENGAGEMENT[project.engagement]],
  ];
  const poster = el(
    'section',
    { class: 'pd__poster', 'data-theme': project.theme, 'aria-label': 'Overview' },
    [
      el('header', { class: 'pd__head' }, [
        el('p', { class: 'pd__client' }, [project.client]),
        el('p', { class: 'pd__index' }, [
          el('span', { 'aria-hidden': 'true' }, [first]),
          el('span', { 'aria-hidden': 'true' }, [second]),
          el('span', { class: 'visually-hidden' }, [periodText(project.period)]),
        ]),
      ]),
      title,
      el(
        'dl',
        { class: 'pd__facts' },
        facts.map(([term, detail]) =>
          el('div', {}, [el('dt', {}, [term]), el('dd', {}, [detail])]),
        ),
      ),
      el(
        'ul',
        { class: 'pd__tracks', 'aria-label': 'Stack and highlights' },
        project.tracklist.map((t) =>
          el('li', {}, [
            el('span', {}, [t.label]),
            ...(t.value ? [el('span', {}, [t.value])] : []),
          ]),
        ),
      ),
      ...links(project),
      el('div', { class: 'pd__art' }, [renderArtworkElement(project)]),
    ],
  );

  const story: [string, string][] = [
    ['Context', project.body.context],
    ['Contribution', project.body.contribution],
    ['Outcome', project.body.outcome],
  ];
  const content = el('section', { class: 'pd__content', 'aria-label': 'Details' }, [
    hero,
    el('p', { class: 'pd__summary' }, [project.summary]),
    el(
      'div',
      { class: 'pd__story' },
      story.flatMap(([h, p]) => [el('h3', {}, [h]), el('p', {}, [p])]),
    ),
    ...(project.metrics?.length
      ? [
          el(
            'ul',
            { class: 'pd__metrics', 'aria-label': 'Results' },
            project.metrics.map((m) =>
              el('li', {}, [
                el('span', { class: 'pd__metric-value' }, [m.value]),
                el('span', { class: 'pd__metric-label' }, [m.label]),
                ...(m.baseline && m.result
                  ? [el('span', { class: 'pd__metric-delta' }, [`${m.baseline} → ${m.result}`])]
                  : []),
              ]),
            ),
          ),
        ]
      : []),
    ...(project.gallery?.length ? [buildGallery(project.gallery)] : []),
    ...(project.draft
      ? [
          el('p', { class: 'pd__draft' }, [
            'Draft copy and placeholder media. Final details pending.',
          ]),
        ]
      : []),
  ]);
  return { body: el('div', { class: 'pd__body' }, [poster, content]), title };
}
