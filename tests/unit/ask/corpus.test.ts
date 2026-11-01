// Ask corpus (spec 005, T401, FR-430).
import { describe, expect, it } from 'vitest';
import type { About, AskChips } from '../../../src/content/ask.ts';
import type { Project } from '../../../src/content/types.ts';
import { validateAbout, validateAsk } from '../../../src/content/validate/ask.ts';
import { type ContentBundle, validateContent } from '../../../src/content/validate/index.ts';
import { type CorpusInput, buildCorpus } from '../../../src/core/ask/corpus.ts';
import { ASK_PROJECTS, baseAbout, baseAsk } from '../../fixtures/content/ask.ts';
import { baseBundle } from '../../fixtures/content/bundle.ts';
import { CTX } from '../../fixtures/content/projects.ts';

function valid<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error('fixture is invalid');
  return result.value;
}

const bundle: ContentBundle = valid(validateContent(baseBundle(), CTX));
const ask: AskChips = valid(validateAsk(baseAsk(), ASK_PROJECTS));
const about: About = valid(validateAbout(baseAbout()));

const input = (projects: readonly Project[] = bundle.projects): CorpusInput => ({
  site: bundle.site,
  resume: bundle.resume,
  eras: bundle.eras,
  projects,
  ask,
  about,
});

/** The same object with its keys in reverse order, at every level. */
function reversed<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v: unknown) => reversed(v)) as T;
  if (typeof value !== 'object' || value === null) return value;
  const entries = Object.entries(value).reverse();
  return Object.fromEntries(entries.map(([k, v]) => [k, reversed(v)])) as T;
}

describe('buildCorpus (FR-430)', () => {
  it('includes every public project, the about sections, and the written answers', () => {
    const corpus = buildCorpus(input());
    for (const p of bundle.projects) expect(corpus).toContain(`<project slug="${p.slug}">`);
    expect(corpus).toContain('<about id="how-i-work" topic="process">');
    expect(corpus).toContain('Question: How does Eric run a design system?');
    expect(corpus).toContain(`Name: ${bundle.site.name}`);
  });

  it('leaves drafts out', () => {
    const [first, ...rest] = bundle.projects;
    if (first === undefined) throw new Error('empty fixture');
    const corpus = buildCorpus(input([{ ...first, draft: true }, ...rest]));
    expect(corpus).not.toContain(`slug="${first.slug}"`);
    expect(corpus.match(/<project /g)).toHaveLength(rest.length);
  });

  it('is byte-identical across runs and ignores source key order', () => {
    const a = buildCorpus(input());
    expect(buildCorpus(input())).toBe(a);
    expect(buildCorpus(reversed(input()))).toBe(a);
  });

  it('has no timestamps', () => {
    expect(buildCorpus(input())).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
