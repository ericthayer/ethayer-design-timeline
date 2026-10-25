// One atomic commit on `main` through the Git Data API (spec 004 github-publish FR-365–FR-370).
// Only the final `PATCH git/refs` changes what anyone sees; everything before it is orphaned
// objects GitHub garbage-collects if we stop early.
import type { AdminSession } from '../auth/session.ts';
import { failureOf, repoPath, request, send, type Ok } from './client.ts';
import { conflictingPaths } from './conflict.ts';
import { isNotFastForward, type HttpError } from './errors.ts';
import { withTrailer } from './message.ts';
import { checkChanges, checkEntryCount } from './paths.ts';
import { expandDeletes, needsTree, toBase64, treeEntries, type Upload } from './tree.ts';
import {
  isCommit,
  isCompare,
  isRef,
  isSha,
  isTree,
  type FileChange,
  type PublishRequest,
  type PublishResult,
} from './types.ts';

/** FR-365: at most 3 blob uploads in flight. */
const MAX_IN_FLIGHT = 3;

type Put = Extract<FileChange, { kind: 'put' | 'put-binary' }>;
/** One pass lost the ref race and may be retried. */
type Attempt = PublishResult | { readonly kind: 'race'; readonly headSha: string };

const isPut = (change: FileChange): change is Put =>
  change.kind === 'put' || change.kind === 'put-binary';

const blobBody = (put: Put): { content: string; encoding: 'utf-8' | 'base64' } =>
  put.kind === 'put'
    ? { content: put.content, encoding: 'utf-8' }
    : { content: toBase64(put.bytes), encoding: 'base64' };

/**
 * Uploads every put not already in `cache` (path → blob sha), 3 at a time. Blobs are
 * content-addressed, so a retry reuses them (FR-370). Stops starting uploads after a failure.
 */
async function uploadBlobs(
  session: AdminSession,
  puts: readonly Put[],
  cache: Map<string, string>,
): Promise<Ok<readonly Upload[]> | HttpError> {
  const queue = puts.filter((p) => !cache.has(p.path));
  const failures: HttpError[] = [];
  const worker = async (): Promise<void> => {
    for (
      let next = queue.shift();
      next !== undefined && failures.length === 0;
      next = queue.shift()
    ) {
      const path = repoPath(session, 'git/blobs');
      const blob = await request(session, 'POST', path, isSha, blobBody(next));
      if (blob.kind === 'ok') cache.set(next.path, blob.value.sha);
      else failures.push(blob);
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, queue.length) }, worker));
  const failure = failures[0];
  if (failure) return failure;
  const uploads: Upload[] = [];
  for (const put of puts) {
    const sha = cache.get(put.path);
    if (sha === undefined) return { kind: 'unknown', status: 0 };
    uploads.push({ path: put.path, sha });
  }
  return { kind: 'ok', value: uploads };
}

/** Ref → (compare) → commit → (tree) → blobs → tree → commit → ref. */
async function attempt(
  session: AdminSession,
  req: PublishRequest,
  cache: Map<string, string>,
): Promise<Attempt> {
  const at = (rest: string): `/${string}` => repoPath(session, rest);
  const branch = encodeURIComponent(session.repo.branch);

  const ref = await request(session, 'GET', at(`git/ref/heads/${branch}`), isRef);
  if (ref.kind !== 'ok') return ref;
  const head = ref.value.object.sha;
  const rebased = head !== req.expectedHeadSha;

  if (rebased) {
    const compare = await request(
      session,
      'GET',
      at(`compare/${req.expectedHeadSha}...${head}`),
      isCompare,
    );
    if (compare.kind !== 'ok') return compare;
    const check = conflictingPaths(compare.value, req.changes);
    if (check.kind === 'conflict') return { ...check, headSha: head };
  }

  const base = await request(session, 'GET', at(`git/commits/${head}`), isCommit);
  if (base.kind !== 'ok') return base;
  const baseTree = base.value.tree.sha;

  let deletions: string[] = [];
  if (needsTree(req.changes)) {
    const listing = await request(session, 'GET', at(`git/trees/${baseTree}?recursive=1`), isTree);
    if (listing.kind !== 'ok') return listing;
    // A truncated listing could hide files a delete-dir must remove (FR-366).
    if (listing.value.truncated) return { kind: 'unknown', status: 0 };
    deletions = expandDeletes(req.changes, listing.value.tree);
  }

  const puts = req.changes.filter(isPut);
  const count = puts.length + deletions.length;
  const tooMany = checkEntryCount(count);
  if (tooMany) return tooMany;
  if (count === 0) return { kind: 'unchanged', headSha: head };

  const uploads = await uploadBlobs(session, puts, cache);
  if (uploads.kind !== 'ok') return uploads;

  const tree = await request(session, 'POST', at('git/trees'), isSha, {
    base_tree: baseTree,
    tree: treeEntries(uploads.value, deletions),
  });
  if (tree.kind !== 'ok') return tree;
  if (tree.value.sha === baseTree) return { kind: 'unchanged', headSha: head };

  const commit = await request(session, 'POST', at('git/commits'), isCommit, {
    message: withTrailer(req.message),
    tree: tree.value.sha,
    parents: [head],
  });
  if (commit.kind !== 'ok') return commit;

  // FR-370: never `force: true`.
  const moved = await send(session, 'PATCH', at(`git/refs/heads/${branch}`), {
    sha: commit.value.sha,
    force: false,
  });
  if (moved.kind === 'response' && moved.status >= 200 && moved.status < 300) {
    return { kind: 'ok', commitSha: commit.value.sha, commitUrl: commit.value.html_url, rebased };
  }
  if (moved.kind === 'response' && isNotFastForward(moved.status, moved.json)) {
    return { kind: 'race', headSha: head };
  }
  return failureOf(moved);
}

/**
 * Publishes `request.changes` as one commit on `main` (FR-365). Checks paths and limits before
 * any request. A lost ref race retries once from a fresh head, keeping `expectedHeadSha` and the
 * uploaded blobs. Never throws.
 */
export async function publish(
  session: AdminSession,
  request: PublishRequest,
): Promise<PublishResult> {
  const problem = checkChanges(request);
  if (problem) return problem;
  const cache = new Map<string, string>();
  try {
    let last: Attempt = { kind: 'race', headSha: request.expectedHeadSha };
    for (let i = 0; i < 2 && last.kind === 'race'; i += 1) {
      last = await attempt(session, request, cache);
    }
    return last.kind === 'race'
      ? { kind: 'conflict', reason: 'race', paths: [], headSha: last.headSha }
      : last;
  } catch {
    return { kind: 'unknown', status: 0 };
  }
}
