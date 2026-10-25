// Polls a commit's combined status until Netlify finishes (spec 004 github-publish FR-375).
import type { AdminSession } from '../auth/session.ts';
import { repoPath, request } from './client.ts';
import { deployStateFrom, isFinal, sameState } from './deploy-state.ts';
import { isSha } from './paths.ts';
import { isCombinedStatus, type DeployState, type WatchOptions } from './types.ts';

const INTERVAL_MS = 10_000;
const TIMEOUT_MS = 5 * 60_000;

/** Resolves after `ms`, or as soon as `signal` aborts. */
function sleepFor(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

/**
 * Polls now, then every 10 s for up to 5 min, yielding a state only when it changes. Ends after
 * `live`, `failed`, or `unknown` (`timeout`, `no-access` on 403/404, or `error`). Aborting
 * `options.signal` ends it without yielding again.
 */
export async function* watchDeploy(
  session: AdminSession,
  commitSha: string,
  options: WatchOptions = {},
): AsyncIterable<DeployState> {
  const { signal } = options;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? sleepFor;
  const interval = options.intervalMs ?? INTERVAL_MS;
  const deadline = now() + (options.timeoutMs ?? TIMEOUT_MS);
  if (!isSha(commitSha)) {
    yield { kind: 'unknown', reason: 'error' };
    return;
  }
  const path = repoPath(session, `commits/${commitSha}/status`);
  let last: DeployState | null = null;
  for (;;) {
    if (signal?.aborted) return;
    const status = await request(session, 'GET', path, isCombinedStatus);
    if (signal?.aborted) return;
    let state: DeployState;
    if (status.kind === 'ok') state = deployStateFrom(status.value);
    else if (status.kind === 'forbidden' || status.kind === 'not-found') {
      state = { kind: 'unknown', reason: 'no-access' };
    } else state = { kind: 'unknown', reason: 'error' };
    if (!sameState(last, state)) yield state;
    last = state;
    if (isFinal(state)) return;
    await sleep(interval, signal);
    if (signal?.aborted) return;
    if (now() >= deadline) {
      yield { kind: 'unknown', reason: 'timeout' };
      return;
    }
  }
}
