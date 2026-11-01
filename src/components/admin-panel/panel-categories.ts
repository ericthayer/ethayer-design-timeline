// The Categories fieldset (spec 006 FR-550, spec 004 edit-layer FR-388): one required primary
// and an optional secondary that can't equal it. The shared validator owns `category-ref`.
import { CATEGORIES, type CategoryId } from '../../content/categories.ts';
import type { Project } from '../../content/types.ts';
import { fieldset, select } from './controls.ts';
import type { PanelContext } from './panel-fields.ts';

const NONE = 'none';
type Secondary = CategoryId | typeof NONE;

/** `[primary]` or `[primary, secondary]`; a secondary equal to the primary is dropped. */
export function withCategories(primary: CategoryId, secondary: Secondary): Project['categories'] {
  return secondary === NONE || secondary === primary ? [primary] : [primary, secondary];
}

export function categories(ctx: PanelContext): HTMLFieldSetElement {
  const [primary, secondary] = ctx.working.categories;
  const set = (next: Project['categories']): void => {
    ctx.apply({ kind: 'settings', patch: { categories: next } });
  };
  const options = CATEGORIES.map((c) => [c.id, c.label] as const);
  return fieldset('Categories', 'categories', [
    select('Primary category', options, primary, { key: 'cat-1', pointer: '/categories' }, (id) => {
      set(withCategories(id, secondary ?? NONE));
    }),
    select(
      'Secondary category (optional)',
      [[NONE, 'None'] as const, ...options.filter(([id]) => id !== primary)],
      secondary ?? NONE,
      { key: 'cat-2', pointer: '/categories' },
      (id) => {
        set(withCategories(primary, id));
      },
    ),
  ]);
}
