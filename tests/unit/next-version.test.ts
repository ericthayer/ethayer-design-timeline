import { describe, expect, it } from 'vitest';
import { bumpFor, nextTag } from '../../scripts/next-version.ts';

describe('bumpFor', () => {
  it.each([
    ['feat: add a gallery (#1)', 'minor'],
    ['feat(admin): add a gallery (#1)', 'minor'],
    ['fix(transition): handle skipped transitions (#9)', 'patch'],
    ['perf: lazy-load the dialog (#3)', 'patch'],
    ['feat!: drop the old content format (#4)', 'major'],
    ['refactor(core)!: rename publish (#5)', 'major'],
    ['fix: tidy\n\nBREAKING CHANGE: slugs are immutable', 'major'],
  ] as const)('%s → %s', (message, bump) => {
    expect(bumpFor(message)).toBe(bump);
  });

  it.each([
    'docs: record CP4d (#15)',
    'chore: merge main',
    'ci: add a workflow',
    'content: update dmns via admin\n\nPublished-With: admin editor',
    'Merge pull request #6 from ericthayer/feat/004',
    'feat:',
    'feature: not a type we release',
    '',
  ])('%j makes no release', (message) => {
    expect(bumpFor(message)).toBeNull();
  });
});

describe('nextTag', () => {
  it('bumps each part and resets the lower ones', () => {
    expect(nextTag('v1.2.3', 'patch')).toBe('v1.2.4');
    expect(nextTag('v1.2.3', 'minor')).toBe('v1.3.0');
    expect(nextTag('v1.2.3', 'major')).toBe('v2.0.0');
  });

  it('rejects anything that is not vX.Y.Z', () => {
    expect(nextTag('1.2.3', 'patch')).toBeNull();
    expect(nextTag('v1.2', 'patch')).toBeNull();
    expect(nextTag('v1.2.3-rc.1', 'patch')).toBeNull();
    expect(nextTag('', 'patch')).toBeNull();
  });
});
