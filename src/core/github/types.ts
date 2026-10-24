// github-publish types and wire-shape guards (spec 004 github-publish FR-361, FR-362, FR-373).
// Admin-only: public code never imports anything under src/core/github/ (FR-377).

/** One file change. `ContentChange[]` from content-json is assignable to `FileChange[]`. */
export type FileChange =
  | { readonly kind: 'put'; readonly path: string; readonly content: string }
  | { readonly kind: 'put-binary'; readonly path: string; readonly bytes: Uint8Array }
  | { readonly kind: 'delete'; readonly path: string }
  /** Every file under a media folder. `path` is `media-src/<slug>/`, with the trailing slash. */
  | { readonly kind: 'delete-dir'; readonly path: string };

export interface PublishRequest {
  readonly changes: readonly FileChange[];
  readonly message: string;
  /** From `readHead()` when the editor loaded. */
  readonly expectedHeadSha: string;
}

export type InvalidReason =
  | 'no-changes'
  | 'too-many-changes'
  | 'too-many-entries'
  | 'empty-message'
  | 'bad-sha'
  | 'bad-path'
  | 'not-allowed'
  | 'duplicate-path';

export type GitHubError =
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'forbidden'; readonly reason: 'missing-permission' | 'branch-protected' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'validation-rejected'; readonly message: string }
  | { readonly kind: 'rate-limited'; readonly resetAt: number }
  | { readonly kind: 'network' }
  | { readonly kind: 'unknown'; readonly status: number };

export type Invalid = {
  readonly kind: 'invalid';
  readonly reason: InvalidReason;
  readonly path: string | null;
};
export type TooLarge = {
  readonly kind: 'too-large';
  readonly path: string | null;
  readonly limitBytes: number;
};
export type ConflictReason = 'paths-changed' | 'history-diverged' | 'compare-truncated' | 'race';

export type PublishResult =
  | {
      readonly kind: 'ok';
      readonly commitSha: string;
      readonly commitUrl: string;
      readonly rebased: boolean;
    }
  | { readonly kind: 'unchanged'; readonly headSha: string }
  | {
      readonly kind: 'conflict';
      readonly reason: ConflictReason;
      readonly paths: readonly string[];
      readonly headSha: string;
    }
  | Invalid
  | TooLarge
  | GitHubError;

export type HeadResult = { readonly kind: 'ok'; readonly sha: string } | GitHubError;

/** `invalid` for a path outside the JSON allowlist, `too-large` above GitHub's 1 MB inline cap. */
export type ReadFileResult =
  | { readonly kind: 'ok'; readonly text: string; readonly blobSha: string }
  | Invalid
  | TooLarge
  | GitHubError;

export type DeployState =
  | { readonly kind: 'queued' | 'building' | 'live' | 'failed'; readonly logUrl: string | null }
  | { readonly kind: 'unknown'; readonly reason: 'timeout' | 'no-access' | 'error' };

export interface WatchOptions {
  readonly signal?: AbortSignal;
  /** Poll interval, default 10 s. */
  readonly intervalMs?: number;
  /** Give up after this long, default 5 min. */
  readonly timeoutMs?: number;
  /** Test seams: a fake clock. */
  readonly now?: () => number;
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

// ---- Wire shapes: only the fields this module reads (FR-373) ----

export interface WireRef {
  readonly object: { readonly sha: string };
}
export interface WireCommit {
  readonly sha: string;
  readonly html_url: string;
  readonly tree: { readonly sha: string };
}
export interface WireSha {
  readonly sha: string;
}
export interface WireTreeEntry {
  readonly path: string;
  readonly type: string;
}
export interface WireTree {
  readonly sha: string;
  readonly truncated: boolean;
  readonly tree: readonly WireTreeEntry[];
}
export interface WireCompareFile {
  readonly filename: string;
  readonly previous_filename?: string;
}
export interface WireCompare {
  readonly status: string;
  readonly files: readonly WireCompareFile[];
}
export interface WireStatus {
  readonly context: string;
  readonly state: string;
  readonly target_url: string | null;
}
export interface WireCombinedStatus {
  readonly state: string;
  readonly statuses: readonly WireStatus[];
}
export interface WireContents {
  readonly type: string;
  readonly encoding: string;
  readonly content: string;
  readonly sha: string;
}

type Obj = Readonly<Record<string, unknown>>;

export const isRecord = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const hasSha = (v: unknown): v is WireSha => isRecord(v) && isStr(v['sha']);

export const isRef = (v: unknown): v is WireRef => isRecord(v) && hasSha(v['object']);

export const isCommit = (v: unknown): v is WireCommit =>
  hasSha(v) && isRecord(v) && isStr(v['html_url']) && hasSha(v['tree']);

export const isSha = hasSha;

const isTreeEntry = (v: unknown): v is WireTreeEntry =>
  isRecord(v) && isStr(v['path']) && isStr(v['type']);

export const isTree = (v: unknown): v is WireTree =>
  hasSha(v) &&
  isRecord(v) &&
  typeof v['truncated'] === 'boolean' &&
  Array.isArray(v['tree']) &&
  v['tree'].every(isTreeEntry);

const isCompareFile = (v: unknown): v is WireCompareFile =>
  isRecord(v) &&
  isStr(v['filename']) &&
  (v['previous_filename'] === undefined || isStr(v['previous_filename']));

export const isCompare = (v: unknown): v is WireCompare =>
  isRecord(v) && isStr(v['status']) && Array.isArray(v['files']) && v['files'].every(isCompareFile);

const isStatus = (v: unknown): v is WireStatus =>
  isRecord(v) &&
  isStr(v['context']) &&
  isStr(v['state']) &&
  (v['target_url'] === null || isStr(v['target_url']));

export const isCombinedStatus = (v: unknown): v is WireCombinedStatus =>
  isRecord(v) && isStr(v['state']) && Array.isArray(v['statuses']) && v['statuses'].every(isStatus);

export const isContents = (v: unknown): v is WireContents =>
  hasSha(v) && isRecord(v) && isStr(v['type']) && isStr(v['encoding']) && isStr(v['content']);

/** GitHub's error `message`, or null. */
export function messageOf(body: unknown): string | null {
  return isRecord(body) && isStr(body['message']) ? body['message'] : null;
}
