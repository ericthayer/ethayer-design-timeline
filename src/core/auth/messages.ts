import { ALLOWED_LOGIN, REPO, TOKEN_PREFIX } from './config.ts';
import type { AuthErrorKind } from './verify.ts';

/** One message per error kind, each naming the fix (spec 004 admin-auth FR-348). */
export const AUTH_MESSAGES: Readonly<Record<AuthErrorKind, string>> = {
  empty: 'Paste your GitHub token first.',
  'not-fine-grained': `This isn't a fine-grained token. Create one with the steps above: it starts with ${TOKEN_PREFIX}. Classic tokens (ghp_) aren't accepted.`,
  'bad-token':
    "GitHub didn't accept this token. It may be mistyped, revoked, or expired. Paste it again, or create a new one with the steps above.",
  expired: 'This token has expired. Create a new one with the steps above.',
  'wrong-account': `This token belongs to a different GitHub account. Only ${ALLOWED_LOGIN} can edit this site, so create the token while signed in to GitHub as ${ALLOWED_LOGIN}.`,
  'wrong-repo': `This token can't see the ${REPO.name} repository. Set Repository access to "Only select repositories" and choose ${REPO.name}.`,
  'read-only':
    'This token can read the repository but not change it. Set Contents to Read and write.',
  'rate-limited': 'GitHub is limiting requests right now. Wait a few minutes, then try again.',
  network: "Couldn't reach GitHub. Check your connection, then try again.",
  'github-error': 'GitHub returned an unexpected error. Wait a moment, then try again.',
};

/** The message for `kind`, with the reset time for a rate limit when GitHub sent one. */
export function authMessage(
  kind: AuthErrorKind,
  retryAt: Date | null = null,
  now: number = Date.now(),
): string {
  if (kind === 'rate-limited' && retryAt) {
    const minutes = Math.max(1, Math.ceil((retryAt.getTime() - now) / 60_000));
    return `GitHub is limiting requests right now. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }
  return AUTH_MESSAGES[kind];
}
