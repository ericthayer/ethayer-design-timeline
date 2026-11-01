// Card media and gallery tile settings (spec 004 edit-layer FR-389, FR-390). The validator owns
// the size × media rule; its errors land on the kind control. File uploads join with CP4b (T389).
import type { AnyCardMedia, Focal, ImageMedia, PlaceholderMedia } from '../../content/types.ts';
import { el } from '../../core/dom.ts';
import { checkbox, fieldset, radios, select, textInput } from './controls.ts';
import type { PanelContext } from './panel-fields.ts';

type Kind = Exclude<AnyCardMedia['kind'], never>;
const KINDS: readonly (readonly [Kind, string])[] = [
  ['artwork', 'Swiss artwork'],
  ['placeholder', 'Placeholder'],
  ['image', 'Image'],
  ['video', 'Video loop'],
  ['iframe', 'Live site (iframe)'],
];
export const VARIANTS: readonly (readonly [PlaceholderMedia['variant'], string])[] = [
  ['site', 'Site'],
  ['mobile', 'Mobile'],
  ['video', 'Video'],
  ['design', 'Design'],
];

export const UPLOAD_NOTE = 'Uploading new files arrives with the media pipeline (CP4b).';

const options = (keys: readonly string[], current: string): (readonly [string, string])[] =>
  [...new Set([current, ...keys])].filter((k) => k !== '').map((k) => [k, k] as const);

/** '30% 40%' → [30, 40]; anything else → the centre. */
export function focalParts(focal: string | undefined): [number, number] {
  const match = /^(-?[\d.]+)% (-?[\d.]+)%$/.exec(focal ?? '');
  return match ? [Number(match[1]), Number(match[2])] : [50, 50];
}

const focalOf = (x: number, y: number): Focal => `${x}% ${y}%`;
const clampPct = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));

export function focalInputs(
  label: string,
  focal: string | undefined,
  key: string,
  pointer: string,
  onChange: (focal: Focal) => void,
): HTMLElement[] {
  const [x, y] = focalParts(focal);
  const set = (nx: number, ny: number): void => {
    if (Number.isFinite(nx) && Number.isFinite(ny)) onChange(focalOf(clampPct(nx), clampPct(ny)));
  };
  return [
    textInput(
      `${label} focal X (%)`,
      String(x),
      { key: `${key}-fx`, pointer },
      (v) => {
        set(Number(v), y);
      },
      'number',
    ),
    textInput(
      `${label} focal Y (%)`,
      String(y),
      { key: `${key}-fy`, pointer },
      (v) => {
        set(x, Number(v));
      },
      'number',
    ),
  ];
}

/** Key, alt, focal point, and duotone for an image (a card image or a poster). */
function imageFields(
  ctx: PanelContext,
  label: string,
  image: ImageMedia,
  key: string,
  pointer: string,
  onChange: (image: ImageMedia) => void,
): HTMLElement[] {
  return [
    select(
      `${label} file`,
      options(ctx.imageKeys, image.src),
      image.src,
      { key: `${key}-src`, pointer: `${pointer}/src` },
      (src) => {
        onChange({ ...image, src });
      },
    ),
    textInput(
      `${label} alt text`,
      image.alt,
      { key: `${key}-alt`, pointer: `${pointer}/alt` },
      (alt) => {
        onChange({ ...image, alt });
      },
    ),
    ...focalInputs(label, image.focal, key, `${pointer}/focal`, (focal) => {
      onChange({ ...image, focal });
    }),
    checkbox(
      `${label} duotone`,
      image.treatment === 'duotone',
      { key: `${key}-duo`, pointer: `${pointer}/treatment` },
      (on) => {
        const { treatment: _old, ...rest } = image;
        onChange(on ? { ...rest, treatment: 'duotone' } : rest);
      },
    ),
  ];
}

function posterOf(media: AnyCardMedia, ctx: PanelContext): ImageMedia {
  if (media.kind === 'image') return media;
  if (media.kind === 'video' || media.kind === 'iframe') return media.poster;
  return { kind: 'image', src: ctx.imageKeys[0] ?? `${ctx.slug}/cover`, alt: '' };
}

/** A media value of a new kind that keeps what it can from the current one. */
export function switchKind(kind: Kind, current: AnyCardMedia, ctx: PanelContext): AnyCardMedia {
  const poster = posterOf(current, ctx);
  switch (kind) {
    case 'artwork':
      return { kind };
    case 'placeholder':
      return { kind, variant: 'site' };
    case 'image':
      return poster;
    case 'video':
      return {
        kind,
        src: ctx.videoKeys[0] ?? `${ctx.slug}/clip`,
        poster,
        label: '',
        durationSec: 6,
      };
    case 'iframe':
      return ctx.working.size === 'tall'
        ? { kind, src: 'https://example.com', title: '', viewport: 'mobile', poster }
        : { kind, src: 'https://example.com', title: '', viewport: 'desktop', poster };
  }
}

const isHttps = (v: string): v is `https://${string}` => /^https:\/\/\S+$/.test(v);

function kindFields(
  ctx: PanelContext,
  media: AnyCardMedia,
  set: (m: AnyCardMedia) => void,
): HTMLElement[] {
  switch (media.kind) {
    case 'artwork':
      return [el('p', { class: 'edp__note' }, ['The motif and seed under Card draw it.'])];
    case 'placeholder':
      return [
        select(
          'Placeholder variant',
          VARIANTS,
          media.variant,
          { key: 'media-variant', pointer: '/media/variant' },
          (variant) => {
            set({ ...media, variant });
          },
        ),
      ];
    case 'image':
      return imageFields(ctx, 'Image', media, 'media', '/media', set);
    case 'video':
      return [
        select(
          'Clip',
          options(ctx.videoKeys, media.src),
          media.src,
          { key: 'media-clip', pointer: '/media/src' },
          (src) => {
            set({ ...media, src });
          },
        ),
        textInput(
          'Clip label',
          media.label,
          { key: 'media-label', pointer: '/media/label' },
          (label) => {
            set({ ...media, label });
          },
        ),
        textInput(
          'Duration (seconds, 8 at most)',
          String(media.durationSec),
          { key: 'media-duration', pointer: '/media/durationSec' },
          (v) => {
            const durationSec = Number(v);
            if (Number.isFinite(durationSec)) set({ ...media, durationSec });
          },
          'number',
        ),
        ...imageFields(ctx, 'Poster', media.poster, 'poster', '/media/poster', (poster) => {
          set({ ...media, poster });
        }),
      ];
    case 'iframe':
      return [
        textInput(
          'Site URL',
          media.src,
          { key: 'media-url', pointer: '/media/src' },
          (src) => {
            if (isHttps(src)) set({ ...media, src });
          },
          'url',
        ),
        textInput(
          'Frame title',
          media.title,
          { key: 'media-title', pointer: '/media/title' },
          (title) => {
            set({ ...media, title });
          },
        ),
        radios(
          'Viewport',
          [
            ['desktop', 'Desktop'],
            ['mobile', 'Mobile'],
          ] as const,
          media.viewport,
          { key: 'media-viewport', pointer: '/media/viewport' },
          (viewport) => {
            set(viewport === 'mobile' ? { ...media, viewport } : { ...media, viewport });
          },
        ),
        ...imageFields(ctx, 'Poster', media.poster, 'poster', '/media/poster', (poster) => {
          set({ ...media, poster });
        }),
      ];
  }
}

export function cardMedia(ctx: PanelContext, previewValid: boolean): HTMLFieldSetElement {
  const media = ctx.working.media;
  const set = (next: AnyCardMedia): void => {
    ctx.apply({ kind: 'settings', patch: { media: next } });
  };
  return fieldset('Card media', 'media', [
    ...(previewValid
      ? []
      : [el('p', { class: 'edp__note', role: 'note' }, ['Preview shows the last valid version.'])]),
    select('Media kind', KINDS, media.kind, { key: 'media-kind', pointer: '/media' }, (kind) => {
      set(switchKind(kind, media, ctx));
    }),
    ...kindFields(ctx, media, set),
    el('p', { class: 'edp__note' }, [UPLOAD_NOTE]),
  ]);
}
