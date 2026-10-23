import type { VideoMedia } from '../../content/types.ts';
import { el } from '../../core/dom.ts';
import type { MediaLease } from '../../core/media-scheduler.ts';
import { imageUrl } from './image.ts';

export interface RenderedVideo {
  readonly element: HTMLVideoElement;
  readonly lease: MediaLease;
}

/** Silent card loop (FR-031). Play and pause belong to the scheduler, never autoplay. */
export function renderCardVideo(media: VideoMedia): RenderedVideo {
  const video = el(
    'video',
    {
      class: 'media__video',
      muted: true,
      loop: true,
      playsinline: true,
      preload: 'none',
      disablepictureinpicture: true,
      poster: imageUrl(media.poster.src, 'webp'),
      'aria-hidden': 'true',
      tabindex: '-1',
    },
    [
      el('source', { src: `/media/${media.src}.webm`, type: 'video/webm' }),
      el('source', { src: `/media/${media.src}.mp4`, type: 'video/mp4' }),
    ],
  );
  video.muted = true;
  const lease: MediaLease = {
    kind: 'video',
    mount: () => {
      video.play().catch(() => {
        // Autoplay refused (power saving, policy): the poster stays.
      });
    },
    unmount: () => {
      video.pause();
    },
  };
  return { element: video, lease };
}

/** Dialog video: user-controlled, with an accessible label (FR-052). */
export function renderDialogVideo(media: VideoMedia): HTMLVideoElement {
  const video = el(
    'video',
    {
      class: 'hero__video',
      controls: true,
      muted: true,
      loop: true,
      playsinline: true,
      preload: 'metadata',
      poster: imageUrl(media.poster.src, 'webp', 1440),
      'aria-label': media.label,
    },
    [
      el('source', { src: `/media/${media.src}.webm`, type: 'video/webm' }),
      el('source', { src: `/media/${media.src}.mp4`, type: 'video/mp4' }),
    ],
  );
  video.muted = true;
  return video;
}
