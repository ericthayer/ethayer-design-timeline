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
        sizes: '(min-width: 900px) 30vw, 60vw',
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
 * Bento gallery (spec 003, FR-212–FR-215): tiles of four sizes on a dense grid. Each tile's
 * focal point becomes `--focal` (FR-213); captions carry the text (FR-212).
 */
export function buildGallery(items: readonly GalleryItem[]): HTMLElement {
  return el(
    'ul',
    { class: 'pd__bento', 'aria-label': 'Project gallery' },
    items.map((item) => {
      const tile = el('li', { class: 'pd__tile', 'data-span': item.span ?? 'sm' }, [
        tileMedia(item),
        el('p', { class: 'pd__tile-label' }, [item.label]),
      ]);
      if (item.focal) tile.style.setProperty('--focal', item.focal);
      return tile;
    }),
  );
}
