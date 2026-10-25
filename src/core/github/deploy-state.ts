// Netlify deploy state from a commit's combined status (spec 004 github-publish FR-375). Pure.
import type { DeployState, WireCombinedStatus, WireStatus } from './types.ts';

/**
 * TO VERIFY at CP4d: the context Netlify posts for production deploys, e.g. `deploy/netlify` or
 * `netlify/ethayer-design/deploy-preview`. Any context naming Netlify counts.
 */
export const NETLIFY_CONTEXT = /netlify/i;

/** Owner decision D3: the deploy log link when GitHub gives none. */
export const DEPLOYS_URL = 'https://app.netlify.com/sites/ethayer-design/deploys';

const FAILED = new Set(['failure', 'error']);

/**
 * No Netlify status yet → `queued`. If Netlify posts several, the worst wins: any failure or
 * error → `failed`, then anything not yet `success` → `building`, else `live`.
 */
export function deployStateFrom(combined: WireCombinedStatus): DeployState {
  const netlify = combined.statuses.filter((s) => NETLIFY_CONTEXT.test(s.context));
  const pick = (kind: 'building' | 'live' | 'failed', status: WireStatus): DeployState => ({
    kind,
    logUrl: status.target_url === '' ? null : status.target_url,
  });
  const failed = netlify.find((s) => FAILED.has(s.state));
  if (failed) return pick('failed', failed);
  const pending = netlify.find((s) => s.state !== 'success');
  if (pending) return pick('building', pending);
  const live = netlify[0];
  return live ? pick('live', live) : { kind: 'queued', logUrl: null };
}

/** Same kind and same log link. */
export function sameState(a: DeployState | null, b: DeployState): boolean {
  if (a === null || a.kind !== b.kind) return false;
  if (a.kind === 'unknown' || b.kind === 'unknown') {
    return a.kind === 'unknown' && b.kind === 'unknown' && a.reason === b.reason;
  }
  return a.logUrl === b.logUrl;
}

/** `live`, `failed`, and `unknown` end the watch. */
export const isFinal = (state: DeployState): boolean =>
  state.kind === 'live' || state.kind === 'failed' || state.kind === 'unknown';
