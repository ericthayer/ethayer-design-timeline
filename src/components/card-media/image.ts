import manifestJson from '../../content/media-manifest.json';
import type { ImageMedia, Size } from '../../content/types.ts';
import { el } from '../../core/dom.ts';

export interface ManifestEntry {
  readonly width: number;
  readonly height: number;
  readonly widths: readonly number[];
}

export const MEDIA_MANIFEST: Readonly<Record<string, ManifestEntry | undefined>> = manifestJson;

/** `sizes` per tier (FR-030): cells are 1/cols of the wall, or 1/rows of its height above 1800 px. */
export function sizesFor(size: Size): string {
  const span = size === 'wide' || size === 'feature' ? 2 : 1;
  const vw = (cols: number): string => `${Math.round((100 / cols) * span)}vw`;
  return [
    `(min-width: 1801px) ${34 * span}vh`,
    `(min-width: 1500px) ${vw(6)}`,
    `(min-width: 1200px) ${vw(5)}`,
    `(min-width: 900px) ${vw(4)}`,
    `(min-width: 600px) ${vw(3)}`,
    vw(2),
  ].join(', ');
}

export function imageUrl(src: string, ext: 'avif' | 'webp', preferWidth = 960): string {
  const entry = MEDIA_MANIFEST[src];
  const widths = entry?.widths ?? [preferWidth];
  const width = widths.find((w) => w >= preferWidth) ?? widths[widths.length - 1] ?? preferWidth;
  return `/media/${src}-${width}.${ext}`;
}

export interface PictureOptions {
  readonly sizes: string;
  readonly eager?: boolean;
  readonly className?: string;
}

/** <picture> with AVIF and WebP sources, intrinsic size, focal point (FR-030). */
export function renderPicture(media: ImageMedia, options: PictureOptions): HTMLPictureElement {
  const entry = MEDIA_MANIFEST[media.src];
  const widths = entry?.widths ?? [];
  const srcset = (ext: 'avif' | 'webp'): string =>
    widths.map((w) => `/media/${media.src}-${w}.${ext} ${w}w`).join(', ');
  const img = el('img', {
    src: imageUrl(media.src, 'webp'),
    alt: media.alt,
    width: entry?.width,
    height: entry?.height,
    loading: options.eager ? 'eager' : 'lazy',
    decoding: 'async',
    fetchpriority: options.eager ? 'high' : undefined,
  });
  if (media.focal) img.style.setProperty('--focal', media.focal);
  return el('picture', { class: options.className }, [
    el('source', { type: 'image/avif', srcset: srcset('avif'), sizes: options.sizes }),
    el('source', { type: 'image/webp', srcset: srcset('webp'), sizes: options.sizes }),
    img,
  ]);
}
