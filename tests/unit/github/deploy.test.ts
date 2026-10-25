import { afterEach, describe, expect, it } from 'vitest';
import { deployStateFrom, sameState } from '../../../src/core/github/deploy-state.ts';
import { watchDeploy } from '../../../src/core/github/deploy.ts';
import type { DeployState, WatchOptions } from '../../../src/core/github/types.ts';
import { C2, fakeGitHub, type Reply, type Step } from './fake-github.ts';
import combined from './fixtures/combined-status.json';

const KEY = `GET /commits/${C2}/status`;
const LOG = 'https://app.netlify.com/sites/ethayer-design/deploys/abc123';

const status = (
  state: string | null,
  context = 'netlify/ethayer-design/deploy-preview',
): Reply => ({
  body: {
    state: state ?? 'pending',
    statuses: state === null ? [] : [{ context, state, target_url: LOG }],
  },
});

/** A fake clock: `sleep` advances `now` instantly. */
function clock(): Required<Pick<WatchOptions, 'now' | 'sleep'>> & { elapsed: () => number } {
  let t = 0;
  return {
    now: () => t,
    sleep: (ms) => {
      t += ms;
      return Promise.resolve();
    },
    elapsed: () => t,
  };
}

async function collect(
  steps: readonly Step[],
  options: WatchOptions = {},
): Promise<{ states: DeployState[]; polls: number }> {
  const gh = fakeGitHub({ [KEY]: steps });
  const states: DeployState[] = [];
  for await (const state of watchDeploy(gh.session, C2, { ...clock(), ...options })) {
    states.push(state);
  }
  return { states, polls: gh.calls.length };
}

afterEach(() => {
  sessionStorage.clear();
});

describe('deployStateFrom (FR-375)', () => {
  it('maps the fixture to live with its log link', () => {
    expect(deployStateFrom(combined)).toEqual({ kind: 'live', logUrl: LOG });
  });

  it.each([
    [[], { kind: 'queued', logUrl: null }],
    [
      [{ context: 'ci/build', state: 'success', target_url: null }],
      { kind: 'queued', logUrl: null },
    ],
    [
      [{ context: 'deploy/netlify', state: 'pending', target_url: LOG }],
      { kind: 'building', logUrl: LOG },
    ],
    [
      [{ context: 'deploy/netlify', state: 'failure', target_url: LOG }],
      { kind: 'failed', logUrl: LOG },
    ],
    [
      [{ context: 'deploy/netlify', state: 'error', target_url: null }],
      { kind: 'failed', logUrl: null },
    ],
    [
      [
        { context: 'netlify/a', state: 'success', target_url: LOG },
        { context: 'netlify/b', state: 'pending', target_url: null },
      ],
      { kind: 'building', logUrl: null },
    ],
  ])('%j → %j', (statuses, expected) => {
    expect(deployStateFrom({ state: 'pending', statuses })).toEqual(expected);
  });

  it('compares states', () => {
    expect(sameState(null, { kind: 'queued', logUrl: null })).toBe(false);
    expect(sameState({ kind: 'building', logUrl: 'a' }, { kind: 'building', logUrl: 'b' })).toBe(
      false,
    );
    expect(
      sameState({ kind: 'unknown', reason: 'error' }, { kind: 'unknown', reason: 'error' }),
    ).toBe(true);
  });
});

describe('watchDeploy (FR-375)', () => {
  it('yields queued → building → live, once each', async () => {
    const { states, polls } = await collect([
      status(null),
      status('pending'),
      status('pending'),
      status('success'),
    ]);
    expect(states).toEqual([
      { kind: 'queued', logUrl: null },
      { kind: 'building', logUrl: LOG },
      { kind: 'live', logUrl: LOG },
    ]);
    expect(polls).toBe(4);
  });

  it('stops on failed', async () => {
    const { states } = await collect([status('pending'), status('failure'), status('success')]);
    expect(states.map((s) => s.kind)).toEqual(['building', 'failed']);
  });

  it('ends unknown: timeout at 5 minutes after 30 polls', async () => {
    const fake = clock();
    const { states, polls } = await collect([status(null)], fake);
    expect(states).toEqual([
      { kind: 'queued', logUrl: null },
      { kind: 'unknown', reason: 'timeout' },
    ]);
    expect(polls).toBe(30);
    expect(fake.elapsed()).toBe(5 * 60_000);
  });

  it.each([403, 404])('ends unknown: no-access on %i without retrying', async (code) => {
    const { states, polls } = await collect([{ status: code, body: { message: 'x' } }]);
    expect(states).toEqual([{ kind: 'unknown', reason: 'no-access' }]);
    expect(polls).toBe(1);
  });

  it('ends unknown: error on a rate limit or a shape mismatch', async () => {
    const limited: Reply = { status: 429, headers: { 'retry-after': '60' } };
    expect((await collect([limited])).states).toEqual([{ kind: 'unknown', reason: 'error' }]);
    expect((await collect([{ body: { nope: true } }])).states).toEqual([
      { kind: 'unknown', reason: 'error' },
    ]);
  });

  it('stops on abort', async () => {
    const controller = new AbortController();
    const gh = fakeGitHub({ [KEY]: [status(null), status('pending')] });
    const states: DeployState[] = [];
    for await (const state of watchDeploy(gh.session, C2, {
      ...clock(),
      signal: controller.signal,
    })) {
      states.push(state);
      controller.abort();
    }
    expect(states).toEqual([{ kind: 'queued', logUrl: null }]);
    expect(gh.calls).toHaveLength(1);
  });

  it('aborts a real sleep promptly', async () => {
    const controller = new AbortController();
    const gh = fakeGitHub({ [KEY]: status(null) });
    const started = Date.now();
    const states: DeployState[] = [];
    setTimeout(() => {
      controller.abort();
    }, 20);
    for await (const state of watchDeploy(gh.session, C2, { signal: controller.signal })) {
      states.push(state);
    }
    expect(states).toEqual([{ kind: 'queued', logUrl: null }]);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('refuses a malformed sha without a request', async () => {
    const gh = fakeGitHub({});
    const states: DeployState[] = [];
    for await (const state of watchDeploy(gh.session, '../x', clock())) states.push(state);
    expect(states).toEqual([{ kind: 'unknown', reason: 'error' }]);
    expect(gh.calls).toHaveLength(0);
  });
});
