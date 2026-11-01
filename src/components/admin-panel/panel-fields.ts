// Card settings sections (spec 004 edit-layer FR-388): identity, card, order, links, metrics,
// notice, and danger. Each change becomes one `EditOp`; the layer re-renders the dialog.
import { ERAS } from '../../content/eras.ts';
import { MOTIFS } from '../../content/motifs.ts';
import { THEMES } from '../../content/themes.ts';
import type { Engagement, Layout, ProjectOrder, Size, Treatment } from '../../content/types.ts';
import { isYearMonth } from '../../content/validate/read.ts';
import { el } from '../../core/dom.ts';
import type { EditableProject } from '../../core/editor/draft.ts';
import type { EditOp } from '../../core/editor/ops.ts';
import { button, checkbox, fieldset, radios, same, select, textInput } from './controls.ts';

export interface PanelContext {
  readonly slug: string;
  readonly working: EditableProject;
  readonly order: ProjectOrder;
  /** Image and video keys the editor knows for this project (manifest ∪ staged). */
  readonly imageKeys: readonly string[];
  readonly videoKeys: readonly string[];
  apply(op: EditOp): void;
  /** Danger zone: opens the Delete confirmation (T391). */
  requestDelete(): void;
  /** A create draft's slug can change until its first publish; returns the problem, if any. */
  readonly rename?: (slug: string) => string | null;
}

const ENGAGEMENTS: readonly (readonly [Engagement, string])[] = [
  ['full-time', 'Full-time'],
  ['contract', 'Contract'],
  ['freelance', 'Freelance'],
  ['personal', 'Personal study'],
  ['education', 'Education'],
];
const SIZES: readonly (readonly [Size, string])[] = [
  ['sm', 'Small'],
  ['wide', 'Wide'],
  ['tall', 'Tall'],
  ['feature', 'Feature'],
];
function randomSeed(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return (value[0] ?? 1) % 100_000;
}

/** A problem the validator can't see (a taken slug), shown on its field (FR-393, FR-395). */
function showProblem(field: HTMLElement | undefined, problem: string | null): void {
  const input = field?.querySelector('input');
  if (!field || !input) return;
  const old = field.nextElementSibling;
  if (old?.matches('.ed-error') === true) old.remove();
  input.removeAttribute('aria-invalid');
  input.removeAttribute('aria-describedby');
  if (problem === null) return;
  const id = `${input.id}-problem`;
  field.after(el('span', { id, class: 'ed-error' }, [problem]));
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', id);
}

export function identity(ctx: PanelContext): HTMLFieldSetElement {
  const p = ctx.working;
  const set = (patch: Parameters<PanelContext['apply']>[0]): void => {
    ctx.apply(patch);
  };
  const present = p.period.end === 'present';
  const endInput = textInput(
    'Period end',
    present ? '' : p.period.end,
    { key: 'end', pointer: '/period/end' },
    (v) => {
      if (isYearMonth(v)) set({ kind: 'settings', patch: { period: { ...p.period, end: v } } });
    },
    'month',
  );
  endInput.querySelector('input')?.toggleAttribute('disabled', present);
  const rename = ctx.rename;
  const slug =
    rename === undefined
      ? []
      : [
          textInput('Slug (until the first publish)', p.slug, { key: 'slug' }, (v) => {
            showProblem(slugField, rename(v.trim()));
          }),
        ];
  const slugField = slug[0];
  return fieldset('Identity', 'identity', [
    ...slug,
    textInput('Client', p.client, { key: 'client', pointer: '/client' }, (client) => {
      set({ kind: 'settings', patch: { client } });
    }),
    textInput('Role', p.role, { key: 'role', pointer: '/role' }, (role) => {
      set({ kind: 'settings', patch: { role } });
    }),
    select(
      'Era',
      ERAS.map((e) => [e.id, e.label] as const),
      p.era,
      { key: 'era', pointer: '/era' },
      (era) => {
        set({ kind: 'settings', patch: { era } });
      },
    ),
    select(
      'Engagement',
      ENGAGEMENTS,
      p.engagement,
      { key: 'engagement', pointer: '/engagement' },
      (engagement) => {
        set({ kind: 'settings', patch: { engagement } });
      },
    ),
    textInput(
      'Period start',
      p.period.start,
      { key: 'start', pointer: '/period/start' },
      (v) => {
        if (isYearMonth(v)) set({ kind: 'settings', patch: { period: { ...p.period, start: v } } });
      },
      'month',
    ),
    endInput,
    checkbox('Present', present, { key: 'present' }, (on) => {
      set({
        kind: 'settings',
        patch: { period: { ...p.period, end: on ? 'present' : p.period.start } },
      });
    }),
  ]);
}

export function card(ctx: PanelContext): HTMLFieldSetElement {
  const p = ctx.working;
  const patch = (value: Parameters<PanelContext['apply']>[0]): void => {
    ctx.apply(value);
  };
  return fieldset('Card', 'card', [
    select('Size', SIZES, p.size, { key: 'size', pointer: '/size' }, (size) => {
      patch({ kind: 'settings', patch: { size } });
    }),
    radios<Treatment>(
      'Treatment',
      [
        ['standard', 'Standard'],
        ['swiss', 'Swiss poster'],
      ],
      p.treatment,
      { key: 'treatment', pointer: '/treatment' },
      (treatment) => {
        patch({ kind: 'settings', patch: { treatment } });
      },
    ),
    radios<Layout>(
      'Layout',
      [
        ['title-top', 'Title on top'],
        ['title-bottom', 'Title at the bottom'],
      ],
      p.layout,
      { key: 'layout', pointer: '/layout' },
      (layout) => {
        patch({ kind: 'settings', patch: { layout } });
      },
    ),
    select('Theme', same(THEMES), p.theme, { key: 'theme', pointer: '/theme' }, (theme) => {
      patch({ kind: 'settings', patch: { theme } });
    }),
    select('Motif', same(MOTIFS), p.motif, { key: 'motif', pointer: '/motif' }, (motif) => {
      patch({ kind: 'settings', patch: { motif } });
    }),
    textInput(
      'Seed (empty uses the default)',
      p.seed === undefined ? '' : String(p.seed),
      { key: 'seed', pointer: '/seed' },
      (v) => {
        const seed = v.trim() === '' ? null : Number(v);
        if (seed === null || Number.isInteger(seed)) patch({ kind: 'settings', patch: { seed } });
      },
      'number',
    ),
    button('New seed', { key: 'new-seed' }, () => {
      patch({ kind: 'settings', patch: { seed: randomSeed() } });
    }),
  ]);
}

export function order(ctx: PanelContext): HTMLFieldSetElement {
  const slugs = ctx.order[ctx.working.era] ?? [];
  const at = slugs.indexOf(ctx.slug);
  const era = ERAS.find((e) => e.id === ctx.working.era)?.label ?? ctx.working.era;
  const move = (to: number): (() => void) | null =>
    at < 0 || to < 0 || to >= slugs.length
      ? null
      : () => {
          ctx.apply({ kind: 'move-in-era', to });
        };
  return fieldset('Order', 'order', [
    el('p', { class: 'edp__note' }, [
      at < 0
        ? `Not listed in ${era} yet.`
        : `Position ${String(at + 1)} of ${String(slugs.length)} in ${era}`,
    ]),
    el('div', { class: 'edp__row' }, [
      button('Move earlier', { key: 'order-up' }, move(at - 1)),
      button('Move later', { key: 'order-down' }, move(at + 1)),
    ]),
  ]);
}

export function notice(ctx: PanelContext): HTMLFieldSetElement {
  return fieldset('Notice', 'notice', [
    checkbox(
      'Show the Draft copy notice',
      ctx.working.draft === true,
      { key: 'draft', pointer: '/draft' },
      (draft) => {
        ctx.apply({ kind: 'settings', patch: { draft } });
      },
    ),
  ]);
}

export function danger(ctx: PanelContext): HTMLFieldSetElement {
  return fieldset('Danger', 'danger', [
    button('Delete project', { key: 'delete' }, () => {
      ctx.requestDelete();
    }),
  ]);
}
