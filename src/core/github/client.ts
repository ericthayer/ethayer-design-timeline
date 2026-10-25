// Requests through the admin session, plus the two reads (spec 004 github-publish FR-373,
// FR-374). The token never enters this module: `authorizedFetch` adds it (FR-376).
import { SignedOutError, type AdminSession } from '../auth/session.ts';
import { asGitHubError, mapHttpError, type HttpError } from './errors.ts';
import { checkReadPath, PUBLISH_LIMITS } from './paths.ts';
import { fromBase64 } from './tree.ts';
import { isContents, isRef, type HeadResult, type ReadFileResult } from './types.ts';

export type Method = 'GET' | 'POST' | 'PATCH';

/** A response read to the end: its status, headers, and body as `unknown` JSON (null if none). */
export type Sent =
  | {
      readonly kind: 'response';
      readonly status: number;
      readonly headers: Headers;
      readonly json: unknown;
    }
  | { readonly kind: 'network' }
  | { readonly kind: 'unauthorized' };

export type Ok<T> = { readonly kind: 'ok'; readonly value: T };

const SHAPE_MISMATCH = { kind: 'unknown', status: 0 } as const;

const enc = encodeURIComponent;

/** `/repos/{owner}/{name}/{rest}`, owner and name URI-encoded. */
export const repoPath = (session: AdminSession, rest: string): `/${string}` =>
  `/repos/${enc(session.repo.owner)}/${enc(session.repo.name)}/${rest}`;

/** Each segment URI-encoded, slashes kept. */
export const encodePath = (path: string): string => path.split('/').map(enc).join('/');

function parse(text: string): unknown {
  if (text === '') return null;
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return null;
  }
}

/** One request. Never throws: a rejected fetch is `network`, an ended session `unauthorized`. */
export async function send(
  session: AdminSession,
  method: Method,
  path: `/${string}`,
  body?: unknown,
): Promise<Sent> {
  const init: RequestInit =
    body === undefined
      ? { method }
      : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  try {
    const response = await session.authorizedFetch(path, init);
    const json = parse(await response.text());
    return { kind: 'response', status: response.status, headers: response.headers, json };
  } catch (error) {
    return error instanceof SignedOutError ? { kind: 'unauthorized' } : { kind: 'network' };
  }
}

/** The typed failure for a non-2xx response or a failed send. */
export function failureOf(sent: Sent): HttpError {
  if (sent.kind !== 'response') return { kind: sent.kind };
  return mapHttpError(sent.status, sent.headers, sent.json);
}

const isSuccess = (sent: Sent): boolean =>
  sent.kind === 'response' && sent.status >= 200 && sent.status < 300;

/** `send`, then the guard: 2xx and the right shape, or a typed error (FR-373). */
export async function request<T>(
  session: AdminSession,
  method: Method,
  path: `/${string}`,
  guard: (value: unknown) => value is T,
  body?: unknown,
): Promise<Ok<T> | HttpError> {
  const sent = await send(session, method, path, body);
  if (!isSuccess(sent) || sent.kind !== 'response') return failureOf(sent);
  return guard(sent.json) ? { kind: 'ok', value: sent.json } : SHAPE_MISMATCH;
}

/** The sha `main` points at (FR-374). */
export async function readHead(session: AdminSession): Promise<HeadResult> {
  const branch = enc(session.repo.branch);
  const ref = await request(session, 'GET', repoPath(session, `git/ref/heads/${branch}`), isRef);
  return ref.kind === 'ok' ? { kind: 'ok', sha: ref.value.object.sha } : asGitHubError(ref);
}

const utf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * A content JSON file at `ref` (FR-374). `not-found` means the file doesn't exist yet. Files over
 * 1 MB come back with `encoding: "none"` and no content, which is `too-large`.
 */
export async function readFile(
  session: AdminSession,
  path: string,
  ref: string,
): Promise<ReadFileResult> {
  const problem = checkReadPath(path);
  if (problem) return problem;
  if (ref.trim() === '') return { kind: 'invalid', reason: 'bad-sha', path: null };
  const url = repoPath(session, `contents/${encodePath(path)}?ref=${enc(ref)}`);
  const file = await request(session, 'GET', url, isContents);
  if (file.kind !== 'ok') return file;
  const { type, encoding, content, sha } = file.value;
  if (type !== 'file') return SHAPE_MISMATCH;
  if (encoding === 'none') {
    return { kind: 'too-large', path, limitBytes: PUBLISH_LIMITS.maxTextBytes };
  }
  if (encoding !== 'base64') return SHAPE_MISMATCH;
  try {
    return { kind: 'ok', text: utf8.decode(fromBase64(content)), blobSha: sha };
  } catch {
    return SHAPE_MISMATCH;
  }
}
