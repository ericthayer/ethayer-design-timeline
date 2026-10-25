// Path allowlist, path rules, and limits, checked before any request (spec 004 github-publish
// FR-363, FR-364). Pure.
import { CONTENT_DIR } from '../../content/paths.ts';
import { IMAGE_EXTENSIONS, LIMITS, SOURCE_ROOT, VIDEO_EXTENSIONS } from '../media-rules.ts';
import type { FileChange, Invalid, InvalidReason, PublishRequest, TooLarge } from './types.ts';

const MB = 1024 * 1024;

/** FR-364. Exported so the editor can reject a file at pick time. */
export const PUBLISH_LIMITS = {
  maxChanges: 50,
  maxTextBytes: 1 * MB,
  /** Matches media-pipeline FR-322. */
  maxBinaryBytes: LIMITS.maxImageBytes,
  maxTotalBytes: 40 * MB,
  maxTreeEntries: 300,
  maxPathLength: 200,
} as const;

/** The media-pipeline FR-322 source set. GIF is rejected there, so it's rejected here. */
export const MEDIA_EXTENSIONS: readonly string[] = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

const SEGMENT = /^[A-Za-z0-9._-]+$/;
const SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const CONTENT_PREFIX = `${CONTENT_DIR}/`;
const encoder = new TextEncoder();

export const invalid = (reason: InvalidReason, path: string | null): Invalid => ({
  kind: 'invalid',
  reason,
  path,
});

const tooLarge = (path: string | null, limitBytes: number): TooLarge => ({
  kind: 'too-large',
  path,
  limitBytes,
});

export const isSha = (value: string): boolean => SHA.test(value);

/** FR-363 raw rules: no leading `/`, no `\`, no empty or dot-led segment, a safe charset. */
export function isWellFormed(path: string): boolean {
  if (path === '' || path.length > PUBLISH_LIMITS.maxPathLength) return false;
  if (path.startsWith('/') || path.includes('\\')) return false;
  return path.split('/').every((s) => s !== '' && !s.startsWith('.') && SEGMENT.test(s));
}

/** `src/content/data/**\/*.json`. */
export function isContentPath(path: string): boolean {
  return isWellFormed(path) && path.startsWith(CONTENT_PREFIX) && path.endsWith('.json');
}

/** `media-src/<slug>/<file>.<ext>` with an FR-322 extension. */
export function isMediaPath(path: string): boolean {
  if (!isWellFormed(path)) return false;
  const segments = path.split('/');
  const file = segments[2] ?? '';
  const ext = file.slice(file.lastIndexOf('.') + 1);
  return (
    segments.length === 3 &&
    segments[0] === SOURCE_ROOT &&
    file.includes('.') &&
    MEDIA_EXTENSIONS.includes(ext)
  );
}

/** `media-src/<slug>/`, trailing slash included. */
export function isMediaDir(path: string): boolean {
  if (!path.endsWith('/')) return false;
  const bare = path.slice(0, -1);
  const segments = bare.split('/');
  return isWellFormed(bare) && segments.length === 2 && segments[0] === SOURCE_ROOT;
}

const allowed = (change: FileChange): boolean => {
  switch (change.kind) {
    case 'put':
      return isContentPath(change.path);
    case 'put-binary':
      return isMediaPath(change.path);
    case 'delete':
      return isContentPath(change.path) || isMediaPath(change.path);
    case 'delete-dir':
      return isMediaDir(change.path);
  }
};

/** A path's own problem: malformed (`bad-path`) or well-formed but outside the allowlist. */
function pathProblem(change: FileChange): Invalid | null {
  if (allowed(change)) return null;
  const bare = change.kind === 'delete-dir' ? change.path.replace(/\/$/, '') : change.path;
  return invalid(isWellFormed(bare) ? 'not-allowed' : 'bad-path', change.path);
}

/** Raw bytes a change uploads (UTF-8 for text). */
export function byteSize(change: FileChange): number {
  if (change.kind === 'put') return encoder.encode(change.content).length;
  if (change.kind === 'put-binary') return change.bytes.length;
  return 0;
}

/** `readFile` reads content JSON only (FR-363, FR-374). */
export function checkReadPath(path: string): Invalid | null {
  if (isContentPath(path)) return null;
  return invalid(isWellFormed(path) ? 'not-allowed' : 'bad-path', path);
}

/** Every local rule of FR-363 and FR-364. `null` means the request may go out. */
export function checkChanges(request: PublishRequest): Invalid | TooLarge | null {
  const { changes } = request;
  if (changes.length === 0) return invalid('no-changes', null);
  if (changes.length > PUBLISH_LIMITS.maxChanges) return invalid('too-many-changes', null);
  if (request.message.trim() === '') return invalid('empty-message', null);
  if (!isSha(request.expectedHeadSha)) return invalid('bad-sha', null);
  const seen = new Set<string>();
  let total = 0;
  for (const change of changes) {
    const problem = pathProblem(change);
    if (problem) return problem;
    if (seen.has(change.path)) return invalid('duplicate-path', change.path);
    seen.add(change.path);
    const size = byteSize(change);
    const limit =
      change.kind === 'put' ? PUBLISH_LIMITS.maxTextBytes : PUBLISH_LIMITS.maxBinaryBytes;
    if (size > limit) return tooLarge(change.path, limit);
    total += size;
  }
  if (total > PUBLISH_LIMITS.maxTotalBytes) return tooLarge(null, PUBLISH_LIMITS.maxTotalBytes);
  return null;
}

/** FR-364: tree entries after `delete-dir` expansion. */
export function checkEntryCount(count: number): Invalid | null {
  return count > PUBLISH_LIMITS.maxTreeEntries ? invalid('too-many-entries', null) : null;
}
