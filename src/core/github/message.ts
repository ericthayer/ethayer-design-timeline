// Commit messages (spec 004 github-publish FR-371). Pure.

export const TRAILER = 'Published-With: admin editor';

/** `content: update dmns via admin`. */
export const commitMessage = (action: 'create' | 'update' | 'delete', slug: string): string =>
  `content: ${action} ${slug} via admin`;

/** Appends a blank line and the trailer, unless a line of the message already is the trailer. */
export function withTrailer(message: string): string {
  const body = message.trimEnd();
  if (body.split('\n').some((line) => line.trim() === TRAILER)) return body;
  return `${body}\n\n${TRAILER}`;
}
