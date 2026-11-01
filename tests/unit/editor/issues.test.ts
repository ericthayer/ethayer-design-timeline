// Issue → field mapping and the publish gate (spec 004 edit-layer FR-395, T382).
import { describe, expect, it } from 'vitest';
import { countIssues, fieldFor, gateOf, placeIssues } from '../../../src/core/editor/issues.ts';
import { issue } from '../../../src/content/validate/issue.ts';
import { CONTENT_FILES, projectFile } from '../../../src/content/paths.ts';

const FILE = projectFile('demo');
const POINTERS = ['/title', '/gallery', '/gallery/2', '/gallery/2/label', '/media'];

describe('fieldFor', () => {
  it('takes the longest whole-segment prefix in the same file', () => {
    expect(
      fieldFor(issue('a11y-text', FILE, '/gallery/2/label', 'demo', 'm'), FILE, POINTERS),
    ).toBe('/gallery/2/label');
    expect(
      fieldFor(issue('focal-format', FILE, '/gallery/2/focal', 'demo', 'm'), FILE, POINTERS),
    ).toBe('/gallery/2');
    expect(fieldFor(issue('shape', FILE, '/gallery/20/label', 'demo', 'm'), FILE, POINTERS)).toBe(
      '/gallery',
    );
    expect(fieldFor(issue('size-media', FILE, '/media/kind', 'demo', 'm'), FILE, POINTERS)).toBe(
      '/media',
    );
  });

  it('leaves whole-file issues and other files unplaced', () => {
    const whole = issue('swiss-share', FILE, '', 'demo', 'm');
    const other = issue('order', CONTENT_FILES.order, '/cobank', null, 'm');
    const placed = placeIssues(
      [whole, other, issue('text-length', FILE, '/title', 'demo', 'm')],
      FILE,
      POINTERS,
    );
    expect(placed.unplaced).toEqual([whole, other]);
    expect([...placed.byField.keys()]).toEqual(['/title']);
  });
});

describe('gate', () => {
  it('blocks on errors, confirms on warnings only, and goes otherwise', () => {
    const error = issue('text-length', FILE, '/title', 'demo', 'm');
    const warning = issue('swiss-share', FILE, '', 'demo', 'm');
    expect(gateOf([error, warning])).toBe('blocked');
    expect(gateOf([warning])).toBe('confirm');
    expect(gateOf([])).toBe('go');
    expect(countIssues([error, warning, warning])).toEqual({ errors: 1, warnings: 2 });
  });
});
