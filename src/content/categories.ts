/** Project categories for the Projects view (spec 006, FR-500). Code-only vocabulary (FR-551). */
export const CATEGORY_IDS = [
  'design-systems',
  'agentic-engineering',
  'front-end-platforms',
  'product-design',
  'motion-media',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Category {
  readonly id: CategoryId;
  readonly label: string;
  readonly description: string;
}

/** Section order on `/projects`. `Record` coverage keeps labels in step with the ids. */
const DETAILS: Readonly<Record<CategoryId, Omit<Category, 'id'>>> = {
  'design-systems': {
    label: 'Design systems',
    description:
      'Component libraries, tokens, and the pipelines that keep design and code in step.',
  },
  'agentic-engineering': {
    label: 'Agentic engineering',
    description: 'Agent toolkits and spec-driven checks that speed up design-to-code work.',
  },
  'front-end-platforms': {
    label: 'Front-end platforms',
    description: 'Responsive platforms, CSS frameworks, and production front ends.',
  },
  'product-design': {
    label: 'Product and UX design',
    description: 'Discovery, prototypes, and workshops for products and services.',
  },
  'motion-media': {
    label: 'Motion and media',
    description: 'Motion graphics, compositing, and training media.',
  },
};

export const CATEGORIES: readonly Category[] = CATEGORY_IDS.map((id) => ({ id, ...DETAILS[id] }));
