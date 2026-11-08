// Draft visibility (spec 007, FR-600–FR-603).
import { describe, expect, it } from 'vitest';
import { PROJECTS } from '../../src/content/projects/index.ts';
import type { Project } from '../../src/content/types.ts';
import { visibleProjects } from '../../src/core/drafts.ts';

const slugs = (projects: readonly Project[]): string[] => projects.map((p) => p.slug);

describe('visibleProjects (FR-600)', () => {
  const published = PROJECTS.filter((p) => p.draft !== true);
  const drafts = PROJECTS.filter((p) => p.draft === true);

  it('leaves drafts out in production', () => {
    const shown = visibleProjects(PROJECTS, { includeDrafts: false });
    expect(slugs(shown)).toEqual(slugs(published));
    for (const draft of drafts) expect(slugs(shown)).not.toContain(draft.slug);
  });

  it('keeps drafts for the dev server and /admin (FR-602)', () => {
    expect(visibleProjects(PROJECTS, { includeDrafts: true })).toBe(PROJECTS);
  });

  it('keeps the curated order', () => {
    const shown = slugs(visibleProjects(PROJECTS, { includeDrafts: false }));
    const expected = slugs(PROJECTS).filter((slug) => shown.includes(slug));
    expect(shown).toEqual(expected);
  });

  it('does not mutate its input', () => {
    const before = [...PROJECTS];
    visibleProjects(PROJECTS, { includeDrafts: false });
    expect(PROJECTS).toEqual(before);
  });

  it('treats a missing draft flag as published', () => {
    const plain = { ...(PROJECTS[0] as Project) };
    delete plain.draft;
    expect(visibleProjects([plain], { includeDrafts: false })).toEqual([plain]);
  });
});
