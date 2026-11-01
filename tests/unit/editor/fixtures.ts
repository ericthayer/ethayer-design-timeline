// Draft fixtures for the edit-layer units (spec 004 edit-layer §7). Plain data, no DOM.
import type { Draft, EditableProject } from '../../../src/core/editor/draft.ts';
import { CONTENT_FILES, projectFile, serialize } from '../../../src/content/paths.ts';

/** A valid `sm` project, matching `baseProject('demo')` in the content fixtures. */
export function demoProject(overrides: Partial<EditableProject> = {}): EditableProject {
  return {
    slug: 'demo',
    title: 'Demo',
    client: 'Demo Co',
    era: 'cobank',
    engagement: 'full-time',
    categories: ['design-systems'],
    role: 'Engineer',
    period: { start: '2024-01', end: 'present' },
    theme: 'paper-ink',
    motif: 'petals',
    layout: 'title-bottom',
    treatment: 'standard',
    summary: 'A demo project.',
    body: { context: 'Context.', contribution: 'Contribution.', outcome: 'Outcome.' },
    tracklist: [{ label: 'TypeScript' }],
    size: 'sm',
    media: { kind: 'placeholder', variant: 'site' },
    ...overrides,
  };
}

export const SHA = 'a'.repeat(40);
export const ORDER = { cobank: ['demo', 'swiss-one', 'p2', 'p3'] } as const;

/** An update draft whose base is the same project and order, so it starts with no changes. */
export function demoDraft(working: EditableProject = demoProject()): Draft {
  return {
    v: 1,
    slug: working.slug,
    action: 'update',
    base: {
      sha: SHA,
      files: {
        [projectFile(working.slug)]: serialize(working),
        [CONTENT_FILES.order]: serialize(ORDER),
      },
    },
    working,
    order: ORDER,
    staged: [],
    savedAt: 0,
  };
}
