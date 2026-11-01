import type { GalleryItem, VimeoMedia } from '../../content/types.ts';
import { el } from '../../core/dom.ts';
import { hashSeed } from '../../core/format.ts';
import { renderPicture } from '../card-media/image.ts';
import { renderPlaceholder } from '../card-media/placeholder.ts';
import { renderDialogVideo } from '../card-media/video.ts';
import './dialog-gallery.css';

/** Click-to-load Vimeo facade (FR-052, NFR-06): nothing third-party loads until the visitor asks. */
export function vimeoFacade(media: VimeoMedia): HTMLElement {
  const holder = el('div', { class: 'pd__vimeo' });
  const play = el('button', { type: 'button', class: 'pd__play' }, [
    el('span', { class: 'pd__play-icon', 'aria-hidden': 'true' }),
    `Play “${media.title}” (loads Vimeo)`,
  ]);
  play.addEventListener('click', () => {
    const frame = el('iframe', {
      class: 'hero__iframe',
      src: `https://player.vimeo.com/video/${media.id}?dnt=1&autoplay=1`,
      title: media.title,
      allow: 'autoplay; fullscreen; picture-in-picture',
      allowfullscreen: true,
    });
    holder.replaceChildren(frame);
    frame.focus();
  });
  holder.append(play);
  return holder;
}

function tileMedia(item: GalleryItem): HTMLElement {
  const { media } = item;
  switch (media.kind) {
    case 'image':
      return renderPicture(media, {
        sizes: '(min-width: 900px) 40vw, 100vw',
        className: 'pd__tile-media',
      });
    case 'video':
      return renderDialogVideo(media);
    case 'vimeo':
      return vimeoFacade(media);
    case 'placeholder': {
      // Fill the tile (slice) so the focal zoom has something to crop into (FR-215)
      const art = renderPlaceholder(media.variant, hashSeed(item.label));
      art.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      return el('div', { class: 'pd__tile-media pd__tile-media--ph' }, [art]);
    }
  }
}

/**
 * Editorial gallery (spec 006 FR-535, amends 003 FR-212–FR-217): figures in content order on a
 * two-column grid, each captioned underneath with its label and optional note (FR-536). Each
 * figure's focal point becomes `--focal` (FR-213).
 */
export function buildGallery(items: readonly GalleryItem[]): HTMLElement {
  return el(
    'ul',
    { class: 'pd__gallery', 'aria-label': 'Project gallery' },
    items.map((item) => {
      const caption = el('figcaption', { class: 'pd__caption' }, [
        el('strong', { class: 'pd__caption-label' }, [item.label]),
        ...(item.note ? [el('span', { class: 'pd__caption-note' }, [item.note])] : []),
      ]);
      const entry = el('li', { class: 'pd__figure', 'data-span': item.span ?? 'sm' }, [
        el('figure', {}, [el('div', { class: 'pd__frame' }, [tileMedia(item)]), caption]),
      ]);
      if (item.focal) entry.style.setProperty('--focal', item.focal);
      return entry;
    }),
  );
}
