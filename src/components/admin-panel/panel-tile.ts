// Gallery tile settings in the panel (spec 004 edit-layer FR-390): span, focal point, alt text,
// and the placeholder variant. Tile controls on the wall and uploads come with T389 (CP4b).
import type { GalleryItem, GallerySpan } from '../../content/types.ts';
import { el } from '../../core/dom.ts';
import { fieldset, select, textInput } from './controls.ts';
import type { PanelContext } from './panel-fields.ts';
import { UPLOAD_NOTE, VARIANTS, focalInputs } from './panel-media.ts';

const SPANS: readonly (readonly [GallerySpan, string])[] = [
  ['sm', 'Small'],
  ['wide', 'Wide'],
  ['tall', 'Tall'],
  ['feature', 'Feature'],
];

/** Tile settings for one gallery tile (FR-390). */
export function tileSection(ctx: PanelContext, index: number): HTMLFieldSetElement | null {
  const tile = ctx.working.gallery?.[index];
  if (tile === undefined) return null;
  const n = String(index + 1);
  const base = `/gallery/${String(index)}`;
  const put = (item: GalleryItem): void => {
    ctx.apply({ kind: 'set-item', list: 'gallery', index, item });
  };
  const media = tile.media;
  const extra: HTMLElement[] =
    media.kind === 'placeholder'
      ? [
          select(
            'Placeholder variant',
            VARIANTS,
            media.variant,
            { key: `tile-${n}-variant`, pointer: `${base}/media/variant` },
            (variant) => {
              put({ ...tile, media: { ...media, variant } });
            },
          ),
        ]
      : media.kind === 'image'
        ? [
            textInput(
              'Alt text',
              media.alt,
              { key: `tile-${n}-alt`, pointer: `${base}/media/alt` },
              (alt) => {
                put({ ...tile, media: { ...media, alt } });
              },
            ),
          ]
        : media.kind === 'video'
          ? [
              textInput(
                'Poster alt text',
                media.poster.alt,
                { key: `tile-${n}-alt`, pointer: `${base}/media/poster/alt` },
                (alt) => {
                  put({ ...tile, media: { ...media, poster: { ...media.poster, alt } } });
                },
              ),
            ]
          : [];
  return fieldset(`Tile ${n}: ${tile.label}`, `tile-${n}`, [
    select(
      'Span',
      SPANS,
      tile.span ?? 'sm',
      { key: `tile-${n}-span`, pointer: `${base}/span` },
      (span) => {
        put({ ...tile, span });
      },
    ),
    ...focalInputs('Tile', tile.focal, `tile-${n}`, `${base}/focal`, (focal) => {
      put({ ...tile, focal });
    }),
    ...extra,
    el('p', { class: 'edp__note' }, [UPLOAD_NOTE]),
  ]);
}
