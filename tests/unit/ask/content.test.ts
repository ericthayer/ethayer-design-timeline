// Ask content rules (spec 005, T400): ask.json chips (FR-410) and the about.json corpus (FR-435).
import { describe, expect, it } from 'vitest';
import { ASK_FILES } from '../../../src/content/paths.ts';
import { ASK_LIMITS, validateAbout, validateAsk } from '../../../src/content/validate/ask.ts';
import type { Issue, Validated } from '../../../src/content/validate/issue.ts';
import { ASK_PROJECTS, baseAbout, baseAsk } from '../../fixtures/content/ask.ts';
import type { JsonObject } from '../../fixtures/content/projects.ts';

const issuesOf = <T>(result: Validated<T>): readonly Issue[] =>
  result.ok ? result.warnings : [...result.errors, ...result.warnings];
const rulesAt = <T>(result: Validated<T>): [string, string][] =>
  issuesOf(result).map((i) => [i.rule, i.path]);

/** The base ask.json with the first chip changed. */
function withChip(patch: JsonObject): JsonObject {
  const [first, second] = baseAsk()['chips'] as JsonObject[];
  return { chips: [{ ...first, ...patch }, second] };
}

describe('validateAsk (FR-410)', () => {
  it('accepts the base chips', () => {
    const result = validateAsk(baseAsk(), ASK_PROJECTS);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.chips.map((c) => c.id)).toEqual(['design-systems', 'accessibility']);
    expect(issuesOf(result)).toEqual([]);
  });

  it('reports every issue against ask.json', () => {
    const result = validateAsk(withChip({ related: ['nope'] }), ASK_PROJECTS);
    expect(issuesOf(result).map((i) => i.file)).toEqual([ASK_FILES.ask]);
  });

  it.each([
    ['an unknown related slug', { related: ['nope'] }, 'slug', '/chips/0/related/0'],
    ['a draft related slug', { related: ['workbench'] }, 'slug', '/chips/0/related/0'],
    ['a missing follow-up id', { followups: ['missing'] }, 'slug', '/chips/0/followups/0'],
    ['a self follow-up', { followups: ['design-systems'] }, 'slug', '/chips/0/followups/0'],
    ['a non-kebab id', { id: 'Design Systems' }, 'slug', '/chips/0/id'],
    ['a long label', { label: 'x'.repeat(ASK_LIMITS.label + 1) }, 'text-length', '/chips/0/label'],
    ['an empty label', { label: '  ' }, 'a11y-text', '/chips/0/label'],
    [
      'a long paragraph',
      { answer: ['x'.repeat(ASK_LIMITS.paragraph + 1)] },
      'text-length',
      '/chips/0/answer/0',
    ],
    ['an empty paragraph', { answer: [''] }, 'a11y-text', '/chips/0/answer/0'],
    ['no paragraphs', { answer: [] }, 'a11y-text', '/chips/0/answer'],
    ['an unknown topic', { topic: 'gossip' }, 'shape', '/chips/0/topic'],
    ['an unknown key', { extra: true }, 'unknown-key', '/chips/0/extra'],
  ] as const)('refuses %s', (_name, patch, rule, path) => {
    const result = validateAsk(withChip(patch), ASK_PROJECTS);
    expect(result.ok).toBe(false);
    expect(rulesAt(result)).toContainEqual([rule, path]);
  });

  it('refuses a duplicate id', () => {
    const result = validateAsk(withChip({ id: 'accessibility', followups: [] }), ASK_PROJECTS);
    expect(rulesAt(result)).toEqual([['slug', '/chips/1/id']]);
  });

  it('needs 1 to 16 chips', () => {
    const chip = (baseAsk()['chips'] as JsonObject[])[1];
    const many = Array.from({ length: ASK_LIMITS.maxChips + 1 }, (_, i) => ({
      ...chip,
      id: `c${String(i)}`,
    }));
    expect(rulesAt(validateAsk({ chips: [] }, ASK_PROJECTS))).toEqual([['shape', '/chips']]);
    expect(rulesAt(validateAsk({ chips: many }, ASK_PROJECTS))).toEqual([['shape', '/chips']]);
  });

  it('refuses a document that is not an object', () => {
    expect(rulesAt(validateAsk([], ASK_PROJECTS))).toEqual([['shape', '']]);
  });
});

describe('validateAbout (FR-435)', () => {
  it('accepts the base corpus', () => {
    const result = validateAbout(baseAbout());
    expect(result.ok).toBe(true);
    expect(issuesOf(result)).toEqual([]);
  });

  it('caps the corpus at 12,000 characters', () => {
    const text = 'x'.repeat(ASK_LIMITS.aboutChars);
    const result = validateAbout({
      sections: [{ id: 'long', topic: 'work', title: 'Long', text }],
    });
    expect(result.ok).toBe(false);
    expect(rulesAt(result)).toEqual([['text-length', '/sections']]);
  });

  it('refuses an empty text and an unknown topic', () => {
    const sections = [
      { id: 'a', topic: 'work', title: 'A', text: ' ' },
      { id: 'b', topic: 'gossip', title: 'B', text: 'Two.' },
    ];
    expect(rulesAt(validateAbout({ sections }))).toEqual([
      ['a11y-text', '/sections/0/text'],
      ['shape', '/sections/1/topic'],
    ]);
  });

  it('refuses a duplicate id', () => {
    const sections = [
      { id: 'a', topic: 'work', title: 'A', text: 'One.' },
      { id: 'a', topic: 'process', title: 'B', text: 'Two.' },
    ];
    expect(rulesAt(validateAbout({ sections }))).toEqual([['slug', '/sections/1/id']]);
  });
});
