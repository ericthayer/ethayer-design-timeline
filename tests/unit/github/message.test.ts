import { describe, expect, it } from 'vitest';
import { commitMessage, withTrailer } from '../../../src/core/github/message.ts';

describe('commit messages (FR-371)', () => {
  it('formats the subject', () => {
    expect(commitMessage('update', 'dmns')).toBe('content: update dmns via admin');
    expect(commitMessage('create', 'new-thing')).toBe('content: create new-thing via admin');
    expect(commitMessage('delete', 'old')).toBe('content: delete old via admin');
  });

  it('appends a blank line and the trailer', () => {
    expect(withTrailer(commitMessage('update', 'dmns'))).toBe(
      'content: update dmns via admin\n\nPublished-With: admin editor',
    );
  });

  it('never doubles the trailer', () => {
    const once = withTrailer('content: update dmns via admin');
    expect(withTrailer(once)).toBe(once);
    expect(withTrailer(`${once}\n`)).toBe(once);
  });
});
