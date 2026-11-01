// Links and metric details in Card settings (spec 004 edit-layer FR-388). Metric baseline and
// result live here because the public dialog shows them as one `baseline → result` span (FR-387).
import type { Metric, ProjectLink } from '../../content/types.ts';
import { el } from '../../core/dom.ts';
import { button, fieldset, same, select, textInput } from './controls.ts';
import type { PanelContext } from './panel-fields.ts';

const LINK_KINDS: readonly ProjectLink['kind'][] = [
  'live',
  'repo',
  'figma',
  'codepen',
  'storybook',
  'prototype',
  'video',
];

const isHttps = (v: string): v is `https://${string}` => /^https:\/\/\S+$/.test(v);

function rowButtons(
  ctx: PanelContext,
  list: 'links' | 'metrics',
  i: number,
  total: number,
  name: string,
): HTMLElement {
  const move = (to: number): (() => void) | null =>
    to < 0 || to >= total
      ? null
      : () => {
          ctx.apply({ kind: 'move', list, from: i, to });
        };
  return el('div', { class: 'edp__row' }, [
    button('Move earlier', { key: `${list}-${String(i)}-up` }, move(i - 1), `Move earlier ${name}`),
    button('Move later', { key: `${list}-${String(i)}-down` }, move(i + 1), `Move later ${name}`),
    button(
      'Remove',
      { key: `${list}-${String(i)}-remove` },
      () => {
        ctx.apply({ kind: 'remove', list, index: i });
      },
      `Remove ${name}`,
    ),
  ]);
}

export function links(ctx: PanelContext): HTMLFieldSetElement {
  const items = ctx.working.links ?? [];
  const put = (index: number, item: ProjectLink): void => {
    ctx.apply({ kind: 'set-item', list: 'links', index, item });
  };
  const rows = items.map((link, i) => {
    const n = String(i + 1);
    const base = `/links/${String(i)}`;
    return el('div', { class: 'edp__group', role: 'group', 'aria-label': `Link ${n}` }, [
      textInput(
        `Link ${n} label`,
        link.label,
        { key: `links-${String(i)}-label`, pointer: `${base}/label` },
        (label) => {
          put(i, { ...link, label });
        },
      ),
      textInput(
        `Link ${n} URL`,
        link.href,
        { key: `links-${String(i)}-href`, pointer: `${base}/href` },
        (href) => {
          if (isHttps(href)) put(i, { ...link, href });
        },
        'url',
      ),
      select(
        `Link ${n} kind`,
        same(LINK_KINDS),
        link.kind,
        { key: `links-${String(i)}-kind`, pointer: `${base}/kind` },
        (kind) => {
          put(i, { ...link, kind });
        },
      ),
      rowButtons(ctx, 'links', i, items.length, `link ${n}: ${link.label}`),
    ]);
  });
  return fieldset('Links', 'links', [
    ...rows,
    button('Add link', { key: 'links-add' }, () => {
      ctx.apply({
        kind: 'add',
        list: 'links',
        item: { label: 'New link', href: 'https://example.com', kind: 'live' },
      });
    }),
  ]);
}

function withPart(m: Metric, key: 'baseline' | 'result', value: string): Metric {
  const { [key]: _old, ...rest } = m;
  return value.trim() === '' ? rest : { ...rest, [key]: value };
}

export function metrics(ctx: PanelContext): HTMLFieldSetElement {
  const items = ctx.working.metrics ?? [];
  const rows = items.map((m, i) => {
    const n = String(i + 1);
    const put =
      (key: 'baseline' | 'result') =>
      (value: string): void => {
        ctx.apply({ kind: 'set-item', list: 'metrics', index: i, item: withPart(m, key, value) });
      };
    return el(
      'div',
      { class: 'edp__group', role: 'group', 'aria-label': `Metric ${n}: ${m.label}` },
      [
        textInput(
          `Metric ${n} baseline`,
          m.baseline ?? '',
          { key: `metrics-${String(i)}-baseline`, pointer: `/metrics/${String(i)}/baseline` },
          put('baseline'),
        ),
        textInput(
          `Metric ${n} result`,
          m.result ?? '',
          { key: `metrics-${String(i)}-result`, pointer: `/metrics/${String(i)}/result` },
          put('result'),
        ),
      ],
    );
  });
  return fieldset(
    'Metrics',
    'metrics',
    rows.length > 0
      ? rows
      : [el('p', { class: 'edp__note' }, ['No metrics yet. Add one under the story.'])],
  );
}
