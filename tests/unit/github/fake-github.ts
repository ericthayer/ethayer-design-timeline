// A scripted GitHub behind the REAL admin session (spec 004 github-publish §7). Each script key
// is `METHOD /path?query`, relative to /repos/{owner}/{name}. A list of steps is consumed in
// order and its last step repeats. Unscripted calls get a 500 and are still recorded.
import { createSession, type AdminSession } from '../../../src/core/auth/session.ts';
import { createTokenStore } from '../../../src/core/auth/token-store.ts';
import type { FetchLike } from '../../../src/core/auth/verify.ts';

export const TOKEN = 'github_pat_FAKE_SECRET_TOKEN';
export const REPO_ROOT = '/repos/ericthayer/ethayer-design-timeline';

export interface Reply {
  readonly status?: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}
export interface Call {
  readonly key: string;
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly headers: Headers;
}
export type Step = Reply | 'reject' | ((call: Call) => Reply | 'reject');
export type Script = Readonly<Record<string, Step | readonly Step[]>>;

export interface FakeGitHub {
  readonly session: AdminSession;
  readonly calls: Call[];
  /** `METHOD /path` of every call, in order. */
  keys(): string[];
  /** The most requests that were in flight at once. */
  maxInFlight(): number;
}

const isStepList = (value: Step | readonly Step[]): value is readonly Step[] =>
  Array.isArray(value);

function parseBody(body: RequestInit['body']): unknown {
  if (typeof body !== 'string') return null;
  const value: unknown = JSON.parse(body);
  return value;
}

export function fakeGitHub(script: Script): FakeGitHub {
  const calls: Call[] = [];
  const used = new Map<string, number>();
  let inFlight = 0;
  let peak = 0;

  const next = (key: string): Step | undefined => {
    const entry = script[key];
    if (entry === undefined) return undefined;
    if (!isStepList(entry)) return entry;
    const index = used.get(key) ?? 0;
    used.set(key, index + 1);
    return entry[Math.min(index, entry.length - 1)];
  };

  const fetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    const path = url.pathname.startsWith(REPO_ROOT)
      ? url.pathname.slice(REPO_ROOT.length) + url.search
      : url.pathname + url.search;
    const method = init.method ?? 'GET';
    const key = `${method} ${path}`;
    const call: Call = {
      key,
      method,
      path,
      body: parseBody(init.body),
      headers: new Headers(init.headers),
    };
    calls.push(call);
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 0));
    inFlight -= 1;
    const step = next(key);
    const reply = typeof step === 'function' ? step(call) : step;
    if (reply === 'reject') throw new TypeError('Failed to fetch');
    const {
      status = 200,
      body = null,
      headers = {},
    } = reply ?? {
      status: 500,
      body: { message: `unscripted ${key}` },
    };
    const text = body === null ? '' : JSON.stringify(body);
    return new Response(status === 204 ? null : text, { status, headers });
  };

  const { session } = createSession({
    token: TOKEN,
    login: 'ericthayer',
    expiresAt: null,
    store: createTokenStore(() => sessionStorage),
    fetch,
  });
  return {
    session,
    calls,
    keys: () => calls.map((c) => c.key),
    maxInFlight: () => peak,
  };
}

/** A deterministic 40-hex "sha" for test content. */
export function fakeSha(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619) >>> 0;
    b = Math.imul(b + text.charCodeAt(i), 2246822519) >>> 0;
  }
  const hex = (n: number): string => n.toString(16).padStart(8, '0');
  return (hex(a) + hex(b) + hex(a ^ b) + hex(Math.imul(a, 31) >>> 0) + hex(b ^ 0xdeadbeef)).slice(
    0,
    40,
  );
}

/** `POST /git/blobs` that answers with a sha derived from the uploaded content. */
export const blobStep: Step = (call) => {
  const body = call.body;
  const content =
    typeof body === 'object' &&
    body !== null &&
    'content' in body &&
    typeof body.content === 'string'
      ? body.content
      : '';
  return { status: 201, body: { sha: fakeSha(content), url: 'https://api.github.com/x' } };
};

// ---- A happy-path publish script: `main` at H0 (tree T0), new tree T2, new commit C2 ----

export const H0 = '0'.repeat(40);
export const H1 = '1'.repeat(40);
export const T0 = 'e'.repeat(40);
export const T1 = 'f'.repeat(40);
export const T2 = '2'.repeat(40);
export const C2 = 'c'.repeat(40);

export const commitBody = (sha: string, tree: string): Reply['body'] => ({
  sha,
  html_url: `https://github.com/ericthayer/ethayer-design-timeline/commit/${sha}`,
  tree: { sha: tree },
  parents: [],
});

/** A base tree listing for `main`: one project, its media folder, and order.json. */
export const BASE_TREE = [
  { path: 'media-src', type: 'tree' },
  { path: 'media-src/dmns', type: 'tree' },
  { path: 'media-src/dmns/cover.webp', type: 'blob' },
  { path: 'media-src/dmns/shot-1.jpg', type: 'blob' },
  { path: 'src/content/data/order.json', type: 'blob' },
  { path: 'src/content/data/projects/dmns.json', type: 'blob' },
  { path: 'src/content/data/projects/old.json', type: 'blob' },
];

/** `main` at `head` with tree `tree`. */
export const headAt = (head: string, tree: string): Script => ({
  'GET /git/ref/heads/main': { body: { object: { sha: head } } },
  [`GET /git/commits/${head}`]: { body: commitBody(head, tree) },
  [`GET /git/trees/${tree}?recursive=1`]: {
    body: { sha: tree, truncated: false, tree: BASE_TREE },
  },
});

export const publishScript = (overrides: Script = {}): Script => ({
  ...headAt(H0, T0),
  'POST /git/blobs': blobStep,
  'POST /git/trees': { status: 201, body: { sha: T2, truncated: false, tree: [] } },
  'POST /git/commits': { status: 201, body: commitBody(C2, T2) },
  'PATCH /git/refs/heads/main': { body: { object: { sha: C2 } } },
  ...overrides,
});
