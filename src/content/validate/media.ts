// Media readers for cards, posters, and gallery tiles (spec 004 content-json, FR-313).
import type {
  ArtworkMedia,
  GalleryItem,
  IframeMedia,
  ImageMedia,
  PlaceholderMedia,
  VideoMedia,
  VimeoMedia,
} from '../types.ts';
import type { ValidationContext } from './issue.ts';
import { type Reader, readFocal, readHttps } from './read.ts';

/** Every media shape a card can parse to, before the size × media matrix is applied. */
export type CardMediaRead = ArtworkMedia | PlaceholderMedia | ImageMedia | VideoMedia | IframeMedia;
type GalleryMedia = GalleryItem['media'];

const CARD_KINDS = ['artwork', 'placeholder', 'image', 'video', 'iframe'] as const;
const GALLERY_KINDS = ['image', 'video', 'vimeo', 'placeholder'] as const;
const VARIANTS: readonly PlaceholderMedia['variant'][] = ['site', 'mobile', 'video', 'design'];
const VIEWPORTS: readonly IframeMedia['viewport'][] = ['desktop', 'mobile'];
const IMAGE_TREATMENTS: readonly NonNullable<ImageMedia['treatment']>[] = ['duotone', 'none'];
/** Card loops stay short (FR-031). */
const MAX_CARD_VIDEO_SEC = 8;

export const isMobileFrame = (m: IframeMedia): m is IframeMedia<'mobile'> =>
  m.viewport === 'mobile';
export const isDesktopFrame = (m: IframeMedia): m is IframeMedia<'desktop'> =>
  m.viewport === 'desktop';

/** A manifest key that must exist when the manifest is known (rule `media-key`, FR-091, MQ6). */
function readKey(
  r: Reader,
  keys: ReadonlySet<string> | null,
  manifest: string,
): string | undefined {
  const src = r.string('src');
  if (src !== undefined && keys !== null && !keys.has(src)) {
    r.error('media-key', 'src', `"${src}" is not in ${manifest}`);
  }
  return src;
}

function readImageBody(r: Reader, ctx: ValidationContext): ImageMedia | undefined {
  const src = readKey(r, ctx.mediaKeys, 'media-manifest.json');
  const alt = r.text('alt', 'Image alt text');
  const focal = readFocal(r);
  const treatment = r.optionalOneOf('treatment', IMAGE_TREATMENTS);
  if (src === undefined || alt === undefined) return undefined;
  return {
    kind: 'image',
    src,
    alt,
    ...(focal === undefined ? {} : { focal }),
    ...(treatment === undefined ? {} : { treatment }),
  };
}

/** A video or iframe poster: always an image with alt text (FR-091). */
function readPoster(r: Reader, ctx: ValidationContext): ImageMedia | undefined {
  const p = r.object('poster');
  if (p === undefined) return undefined;
  const kind = p.oneOf('kind', ['image'] as const);
  const image = kind === undefined ? undefined : readImageBody(p, ctx);
  p.done();
  return image;
}

function readVideo(r: Reader, ctx: ValidationContext, onCard: boolean): VideoMedia | undefined {
  const src = readKey(r, ctx.videoKeys, 'video-manifest.json');
  const poster = readPoster(r, ctx);
  const label = r.text('label', 'Video label');
  const durationSec = r.number('durationSec');
  if (onCard && durationSec !== undefined && durationSec > MAX_CARD_VIDEO_SEC) {
    r.error(
      'video-duration',
      'durationSec',
      `card video is ${durationSec} s, the limit is ${MAX_CARD_VIDEO_SEC} s`,
    );
  }
  if (src === undefined || poster === undefined || label === undefined) return undefined;
  if (durationSec === undefined) return undefined;
  return { kind: 'video', src, poster, label, durationSec };
}

function readIframe(r: Reader, ctx: ValidationContext): IframeMedia | undefined {
  const src = readHttps(r, 'src');
  if (src !== undefined && !ctx.frameOrigins.includes(new URL(src).origin)) {
    r.error('iframe-host', 'src', `${new URL(src).origin} is not in the CSP frame-src`);
  }
  const title = r.text('title', 'Iframe title');
  const viewport = r.oneOf('viewport', VIEWPORTS);
  const poster = readPoster(r, ctx);
  if (src === undefined || title === undefined || viewport === undefined) return undefined;
  if (poster === undefined) return undefined;
  return { kind: 'iframe', src, title, viewport, poster };
}

function readPlaceholder(r: Reader): PlaceholderMedia | undefined {
  const variant = r.oneOf('variant', VARIANTS);
  return variant === undefined ? undefined : { kind: 'placeholder', variant };
}

function readVimeo(r: Reader): VimeoMedia | undefined {
  const id = r.string('id');
  const title = r.text('title', 'Vimeo title');
  if (id === undefined || title === undefined) return undefined;
  return { kind: 'vimeo', id, title };
}

/** A card's `media` (rule `shape` on the kind; the size matrix is applied by the caller). */
export function readCardMedia(r: Reader, ctx: ValidationContext): CardMediaRead | undefined {
  const kind = r.value('kind');
  if (kind === 'vimeo') {
    r.error('shape', 'kind', 'a card cannot hold Vimeo media; put it in the gallery');
    r.skipRest();
    return undefined;
  }
  switch (r.oneOf('kind', CARD_KINDS)) {
    case 'artwork':
      return { kind: 'artwork' };
    case 'placeholder':
      return readPlaceholder(r);
    case 'image':
      return readImageBody(r, ctx);
    case 'video':
      return readVideo(r, ctx, true);
    case 'iframe':
      return readIframe(r, ctx);
    case undefined:
      r.skipRest();
      return undefined;
  }
}

/** A gallery tile's `media`. Iframes are not allowed in galleries (rule `gallery-media`, FR-211). */
export function readGalleryMedia(r: Reader, ctx: ValidationContext): GalleryMedia | undefined {
  const kind = r.value('kind');
  if (kind === 'iframe' || kind === 'artwork') {
    r.error('gallery-media', 'kind', `a gallery tile cannot hold ${kind} media`);
    r.skipRest();
    return undefined;
  }
  switch (r.oneOf('kind', GALLERY_KINDS)) {
    case 'image':
      return readImageBody(r, ctx);
    case 'video':
      return readVideo(r, ctx, false);
    case 'vimeo':
      return readVimeo(r);
    case 'placeholder':
      return readPlaceholder(r);
    case undefined:
      r.skipRest();
      return undefined;
  }
}
