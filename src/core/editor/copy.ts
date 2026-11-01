// User copy for publish results and deploy states (spec 004 edit-layer FR-397, FR-398). Pure.
// The tables are keyed by every `kind`, so a new result kind fails typecheck until it has copy.
import { DEPLOYS_URL } from '../github/deploy-state.ts';
import type { DeployState, InvalidReason, PublishResult } from '../github/types.ts';

export interface Copy {
  readonly text: string;
  /** True for failures that need action: these go to the `role="alert"` region (FR-396). */
  readonly urgent: boolean;
}

export interface CopyEnv {
  readonly now: number;
  readonly locale?: string;
  readonly timeZone?: string;
}

type Kind = PublishResult['kind'];
type ResultOf = { [K in Kind]: Extract<PublishResult, { kind: K }> };
type Table = { [K in Kind]: (result: ResultOf[K], env: CopyEnv) => Copy };

const status = (text: string): Copy => ({ text, urgent: false });
const alert = (text: string): Copy => ({ text, urgent: true });
const MB = 1024 * 1024;

const INVALID: Record<InvalidReason, string> = {
  'no-changes': 'no changes',
  'too-many-changes': 'too many changes',
  'too-many-entries': 'too many files',
  'empty-message': 'empty message',
  'bad-sha': 'bad commit id',
  'bad-path': 'bad path',
  'not-allowed': 'path not allowed',
  'duplicate-path': 'duplicate path',
};

/** "14:32 (in 12 min)" from an epoch-ms reset time. */
export function resetCopy(resetAt: number, env: CopyEnv): string {
  const time = new Intl.DateTimeFormat(env.locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(env.timeZone === undefined ? {} : { timeZone: env.timeZone }),
  }).format(resetAt);
  const minutes = Math.max(1, Math.ceil((resetAt - env.now) / 60_000));
  const rel = new Intl.RelativeTimeFormat(env.locale, { style: 'short' }).format(minutes, 'minute');
  return `${time} (${rel})`;
}

const PUBLISH: Table = {
  ok: (r) => status(r.rebased ? 'Published on top of newer commits.' : 'Published.'),
  unchanged: () => status('Nothing to publish: the repository already matches.'),
  conflict: (r) =>
    alert(
      r.reason === 'race'
        ? 'Someone published at the same moment.'
        : `These files changed on GitHub since you started: ${r.paths.join(', ') || 'unknown files'}.`,
    ),
  'rate-limited': (r, env) =>
    alert(`GitHub's rate limit is reached. Try again after ${resetCopy(r.resetAt, env)}.`),
  forbidden: (r) =>
    alert(
      r.reason === 'branch-protected'
        ? 'main is protected (it requires pull requests or blocks direct pushes). Allow your account to bypass the rule, or turn it off.'
        : "Your token can't write here. Set Contents to Read and write.",
    ),
  unauthorized: () => alert('Sign in again to publish.'),
  'too-large': (r) => {
    const limit = `${String(Math.round((r.limitBytes / MB) * 10) / 10)} MB`;
    return alert(`${r.path ?? 'The change'} is larger than the ${limit} limit.`);
  },
  invalid: (r) =>
    alert(
      `The editor built a change GitHub refused (${INVALID[r.reason]}${r.path === null ? '' : `, ${r.path}`}). Please report it.`,
    ),
  'not-found': () => alert('Repository or branch not found.'),
  'validation-rejected': (r) => alert(`GitHub rejected the commit: ${r.message}`),
  network: () => alert("Couldn't reach GitHub. Your draft is safe."),
  unknown: (r) => alert(`Unexpected response from GitHub (${String(r.status)}).`),
};

function lookup<K extends Kind>(result: ResultOf[K] & { readonly kind: K }, env: CopyEnv): Copy {
  const copy: Table[K] = PUBLISH[result.kind];
  return copy(result, env);
}

/** Toolbar copy for a publish result (FR-397). */
export function publishCopy(result: PublishResult, env: CopyEnv = { now: Date.now() }): Copy {
  return lookup(result, env);
}

export interface DeployCopy {
  readonly label: string;
  readonly detail: string | null;
  readonly link: { readonly text: string; readonly href: string } | null;
}

const FAILED_DETAIL =
  'The live site is unchanged. The commit is on main, so fix the content and publish again.';

/** Badge copy for a deploy state (FR-398). */
export function deployCopy(state: DeployState): DeployCopy {
  switch (state.kind) {
    case 'queued':
      return { label: 'Queued', detail: null, link: null };
    case 'building':
      return { label: 'Building', detail: null, link: null };
    case 'live':
      return { label: 'Live', detail: null, link: null };
    case 'failed':
      return {
        label: 'Build failed',
        detail: FAILED_DETAIL,
        link: { text: 'View log', href: state.logUrl ?? DEPLOYS_URL },
      };
    case 'unknown':
      return {
        label: 'Status unknown',
        detail: null,
        link: { text: 'Check Netlify', href: DEPLOYS_URL },
      };
  }
}
