// HTTP status → typed error (spec 004 github-publish FR-372). Pure. Results carry GitHub's
// message and reason codes only, never headers or bodies (FR-376).
import { PUBLISH_LIMITS } from './paths.ts';
import { messageOf, type GitHubError, type TooLarge } from './types.ts';

/** Every error a request can map to. `too-large` only for a 413. */
export type HttpError = GitHubError | TooLarge;

/** GitHub asks clients to wait at least a minute when it names no reset time. */
const DEFAULT_WAIT_MS = 60_000;
/** TO VERIFY at CP4d: classic protection says "Protected branch update failed", rulesets say
 * "Repository rule violations found". */
const BRANCH_PROTECTED = /protected branch|rule violation/i;
/** TO VERIFY at CP4d: "Update is not a fast forward" (and "Reference cannot be updated" under a
 * concurrent write) on `PATCH git/refs`. */
const NOT_FAST_FORWARD = /not a fast[- ]forward|reference cannot be updated/i;

/** A whole, non-negative number from a header, or null. */
function headerNumber(headers: Headers, name: string): number | null {
  const raw = headers.get(name)?.trim() ?? '';
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

/** When a rate limit lifts (epoch ms), or null when the response isn't rate limiting. */
export function rateLimitReset(
  status: number,
  headers: Headers,
  body: unknown,
  now: number,
): number | null {
  if (status !== 403 && status !== 429) return null;
  if (headers.get('x-ratelimit-remaining')?.trim() === '0') {
    const reset = headerNumber(headers, 'x-ratelimit-reset');
    return reset === null ? now + DEFAULT_WAIT_MS : reset * 1000;
  }
  const retryAfter = headerNumber(headers, 'retry-after');
  if (retryAfter !== null) return now + retryAfter * 1000;
  // A secondary limit without headers, or a bare 429.
  if (status === 429 || /rate limit/i.test(messageOf(body) ?? '')) return now + DEFAULT_WAIT_MS;
  return null;
}

/** The `PATCH git/refs` race (FR-370). */
export const isNotFastForward = (status: number, body: unknown): boolean =>
  status === 422 && NOT_FAST_FORWARD.test(messageOf(body) ?? '');

export function mapHttpError(
  status: number,
  headers: Headers,
  body: unknown,
  now: number = Date.now(),
): HttpError {
  const message = messageOf(body) ?? '';
  const resetAt = rateLimitReset(status, headers, body, now);
  if (resetAt !== null) return { kind: 'rate-limited', resetAt };
  switch (status) {
    case 401:
      return { kind: 'unauthorized' };
    case 403:
      return {
        kind: 'forbidden',
        reason: BRANCH_PROTECTED.test(message) ? 'branch-protected' : 'missing-permission',
      };
    case 404:
      return { kind: 'not-found' };
    case 413:
      // GitHub doesn't say its limit; the per-file cap is the one the editor can act on.
      return { kind: 'too-large', path: null, limitBytes: PUBLISH_LIMITS.maxBinaryBytes };
    case 422:
      return BRANCH_PROTECTED.test(message)
        ? { kind: 'forbidden', reason: 'branch-protected' }
        : { kind: 'validation-rejected', message };
    default:
      return { kind: 'unknown', status };
  }
}

/** For reads whose result has no `too-large` variant. */
export const asGitHubError = (error: HttpError): GitHubError =>
  error.kind === 'too-large' ? { kind: 'unknown', status: 413 } : error;
