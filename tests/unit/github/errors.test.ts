import { describe, expect, it } from 'vitest';
import {
  asGitHubError,
  isNotFastForward,
  mapHttpError,
} from '../../../src/core/github/errors.ts';
import notFastForward from './fixtures/error-not-fast-forward.json';
import permission from './fixtures/error-permission.json';
import protectedBranch from './fixtures/error-protected.json';
import rateLimit from './fixtures/error-rate-limit.json';
import ruleset from './fixtures/error-ruleset.json';

const NOW = 1_800_000_000_000;
const h = (init: Record<string, string> = {}): Headers => new Headers(init);
const RESET = { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000600' };

describe('mapHttpError (FR-372)', () => {
  it.each([
    ['401', 401, h(), { message: 'Bad credentials' }, { kind: 'unauthorized' }],
    ['403 remaining 0', 403, h(RESET), rateLimit, { kind: 'rate-limited', resetAt: 1_800_000_600_000 }],
    ['429 remaining 0', 429, h(RESET), null, { kind: 'rate-limited', resetAt: 1_800_000_600_000 }],
    ['403 retry-after', 403, h({ 'retry-after': '30' }), {}, { kind: 'rate-limited', resetAt: NOW + 30_000 }],
    ['429 retry-after', 429, h({ 'retry-after': '5' }), {}, { kind: 'rate-limited', resetAt: NOW + 5_000 }],
    ['429 bare', 429, h(), {}, { kind: 'rate-limited', resetAt: NOW + 60_000 }],
    [
      '403 secondary limit message',
      403,
      h(),
      { message: 'You have exceeded a secondary rate limit.' },
      { kind: 'rate-limited', resetAt: NOW + 60_000 },
    ],
    ['403 plain', 403, h(), permission, { kind: 'forbidden', reason: 'missing-permission' }],
    ['403 protected', 403, h(), protectedBranch, { kind: 'forbidden', reason: 'branch-protected' }],
    ['404', 404, h(), { message: 'Not Found' }, { kind: 'not-found' }],
    ['413', 413, h(), null, { kind: 'too-large', path: null, limitBytes: 10 * 1024 * 1024 }],
    [
      '422 plain',
      422,
      h(),
      { message: 'Invalid tree info' },
      { kind: 'validation-rejected', message: 'Invalid tree info' },
    ],
    [
      '422 not fast forward',
      422,
      h(),
      notFastForward,
      { kind: 'validation-rejected', message: 'Update is not a fast forward' },
    ],
    ['422 protected', 422, h(), protectedBranch, { kind: 'forbidden', reason: 'branch-protected' }],
    ['422 rule violation', 422, h(), ruleset, { kind: 'forbidden', reason: 'branch-protected' }],
    ['422 no body', 422, h(), null, { kind: 'validation-rejected', message: '' }],
    ['500', 500, h(), { message: 'Server Error' }, { kind: 'unknown', status: 500 }],
    ['502', 502, h(), null, { kind: 'unknown', status: 502 }],
  ])('%s', (_name, status, headers, body, expected) => {
    expect(mapHttpError(status, headers, body, NOW)).toEqual(expected);
  });

  it('falls back to a minute when the reset header is missing', () => {
    expect(mapHttpError(403, h({ 'x-ratelimit-remaining': '0' }), null, NOW)).toEqual({
      kind: 'rate-limited',
      resetAt: NOW + 60_000,
    });
  });

  it('does not treat remaining > 0 as a rate limit', () => {
    const headers = h({ 'x-ratelimit-remaining': '12', 'x-ratelimit-reset': '1800000600' });
    expect(mapHttpError(403, headers, permission, NOW)).toEqual({
      kind: 'forbidden',
      reason: 'missing-permission',
    });
  });

  it('detects the ref race', () => {
    expect(isNotFastForward(422, notFastForward)).toBe(true);
    expect(isNotFastForward(422, { message: 'Reference cannot be updated' })).toBe(true);
    expect(isNotFastForward(422, protectedBranch)).toBe(false);
    expect(isNotFastForward(409, notFastForward)).toBe(false);
  });

  it('narrows too-large for reads', () => {
    expect(asGitHubError({ kind: 'too-large', path: null, limitBytes: 1 })).toEqual({
      kind: 'unknown',
      status: 413,
    });
    expect(asGitHubError({ kind: 'not-found' })).toEqual({ kind: 'not-found' });
  });
});
