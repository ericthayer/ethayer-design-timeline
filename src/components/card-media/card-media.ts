import type { Project } from '../../content/types.ts';
import { el } from '../../core/dom.ts';
import { hashSeed } from '../../core/format.ts';
import type { MediaLease } from '../../core/media-scheduler.ts';
import { SwissArtwork } from '../swiss-artwork/swiss-artwork.ts';
import { renderCardFrame } from './iframe.ts';
import { renderPicture, sizesFor } from './image.ts';
import { renderPlaceholder } from './placeholder.ts';
import { renderCardVideo } from './video.ts';
import './card-media.css';

export interface RenderedMedia {
  readonly element: HTMLElement;
  /** Present for live media the scheduler must mount or play. */
  readonly lease?: MediaLease;
}

export const seedOf = (project: Project): number => project.seed ?? hashSeed(project.slug);

export function renderArtworkElement(project: Project): SwissArtwork {
  const art = new SwissArtwork();
  art.setAttribute('motif', project.motif);
  art.setAttribute('seed', String(seedOf(project)));
  return art;
}

/** Card art zone content by media kind (FR-030–FR-036). */
export function renderCardMedia(
  project: Project,
  options: { eager?: boolean } = {},
): RenderedMedia {
  const { media } = project;
  const sizes = sizesFor(project.size);
  const wrap = (child: Element, kind: string, treatment = 'none'): HTMLElement =>
    el('div', { class: 'media', 'data-kind': kind, 'data-treatment': treatment }, [child]);

  switch (media.kind) {
    case 'artwork':
      return { element: wrap(renderArtworkElement(project), 'artwork') };
    case 'placeholder':
      return { element: wrap(renderPlaceholder(media.variant, seedOf(project)), 'placeholder') };
    case 'image':
      return {
        element: wrap(
          renderPicture(media, {
            sizes,
            eager: options.eager ?? false,
            className: 'media__picture',
          }),
          'image',
          media.treatment ?? 'duotone',
        ),
      };
    case 'video': {
      const { element, lease } = renderCardVideo(media);
      return { element: wrap(element, 'video', 'duotone'), lease };
    }
    case 'iframe': {
      const { element, lease } = renderCardFrame(media, sizes);
      return { element: wrap(element, 'iframe', 'duotone'), lease };
    }
  }
}
