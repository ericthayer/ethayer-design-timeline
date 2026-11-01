import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { SCENARIOS } from './github-mock.ts';

/**
 * A stateful Git Data API for the edit-layer specs (spec 004 edit-layer T393): one branch, files
 * read from the working tree until a commit replaces them, and every write body recorded.
 */

export interface Recorded {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

export interface GitMock {
  /** Every write (POST, PATCH) the page sent, in order. */
  readonly writes: Recorded[];
  head(): string;
  /** Moves the branch as if someone else pushed `paths`. */
  pushElsewhere(paths: readonly string[]): void;
  /** The file's text at the head, or null. */
  file(path: string): string | null;
  /** Fails the next ref update with 422 "not a fast forward" (a race). */
  raceOnce(): void;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type, X-GitHub-Api-Version',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE',
};

const sha = (text: string): string => createHash('sha1').update(text).digest('hex');

interface Commit {
  readonly sha: string;
  readonly parent: string | null;
  /** Repo path → text; only what changed from the working tree. */
  readonly files: ReadonlyMap<string, string | null>;
  readonly changed: readonly string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export async function mockGitHubGit(page: Page): Promise<GitMock> {
  const root = sha('root');
  const commits = new Map<string, Commit>([
    [root, { sha: root, parent: null, files: new Map(), changed: [] }],
  ]);
  const blobs = new Map<string, string>();
  const trees = new Map<string, { base: string; entries: readonly unknown[] }>();
  let head = root;
  let race = false;
  const writes: Recorded[] = [];

  const fileAt = (at: string, path: string): string | null => {
    const commit = commits.get(at);
    if (commit?.files.has(path)) return commit.files.get(path) ?? null;
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  };
  const commitOn = (parent: string, changes: Map<string, string | null>): string => {
    const prev = commits.get(parent);
    const files = new Map(prev?.files);
    for (const [p, t] of changes) files.set(p, t);
    const id = sha(`${parent}:${JSON.stringify([...changes])}:${String(commits.size)}`);
    commits.set(id, { sha: id, parent, files, changed: [...changes.keys()] });
    return id;
  };
  const changedSince = (from: string, to: string): string[] => {
    const out: string[] = [];
    for (let at: string | null = to; at !== null && at !== from;) {
      const c = commits.get(at);
      out.push(...(c?.changed ?? []));
      at = c?.parent ?? null;
    }
    return out;
  };

  await page.route('https://api.github.com/**', async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, '');
    const body: unknown = method === 'GET' ? null : request.postDataJSON();
    if (method !== 'GET') writes.push({ method, path, body });
    const reply = (status: number, json: unknown): Promise<void> =>
      route.fulfill({
        status,
        headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify(json),
      });
    if (url.pathname === '/user') return reply(200, SCENARIOS.ok.user.body);
    if (path === '' || path === '/') return reply(200, SCENARIOS.ok.repo.body);
    if (path.startsWith('/git/ref/heads/')) return reply(200, { object: { sha: head } });
    const contents = /^\/contents\/(.+)$/.exec(path);
    if (contents) {
      const text = fileAt(
        url.searchParams.get('ref') ?? head,
        decodeURIComponent(contents[1] ?? ''),
      );
      if (text === null) return reply(404, { message: 'Not Found' });
      return reply(200, {
        type: 'file',
        encoding: 'base64',
        content: Buffer.from(text).toString('base64'),
        sha: sha(text),
      });
    }
    const compare = /^\/compare\/([0-9a-f]+)\.\.\.([0-9a-f]+)$/.exec(path);
    if (compare) {
      const files = changedSince(compare[1] ?? '', compare[2] ?? '').map((filename) => ({
        filename,
      }));
      return reply(200, { status: 'ahead', files });
    }
    const commitGet = /^\/git\/commits\/([0-9a-f]+)$/.exec(path);
    if (commitGet) {
      const id = commitGet[1] ?? '';
      return reply(200, {
        sha: id,
        html_url: `https://github.com/o/r/commit/${id}`,
        tree: { sha: `t${id}` },
      });
    }
    if (/^\/git\/trees\/t[0-9a-f]+$/.test(path)) {
      // Project files from the working tree, plus two media files per slug in the dmns folder.
      const projects = readdirSync('src/content/data/projects').map(
        (f) => `src/content/data/projects/${f}`,
      );
      const listing = [...projects, 'media-src/dmns/cover.png', 'media-src/dmns/shot.png'].map(
        (p) => ({ path: p, type: 'blob' }),
      );
      return reply(200, { sha: path.slice(11), truncated: false, tree: listing });
    }
    if (path === '/git/blobs' && isRecord(body)) {
      const content = String(body['content']);
      const text =
        body['encoding'] === 'base64' ? Buffer.from(content, 'base64').toString() : content;
      const id = sha(`blob:${text}`);
      blobs.set(id, text);
      return reply(201, { sha: id });
    }
    if (path === '/git/trees' && isRecord(body)) {
      const id = sha(`tree:${JSON.stringify(body)}`);
      trees.set(id, {
        base: String(body['base_tree']),
        entries: Array.isArray(body['tree']) ? body['tree'] : [],
      });
      return reply(201, { sha: id });
    }
    if (path === '/git/commits' && isRecord(body)) {
      const tree = trees.get(String(body['tree']));
      const parents = Array.isArray(body['parents']) ? body['parents'] : [];
      const changes = new Map<string, string | null>();
      for (const entry of tree?.entries ?? []) {
        if (!isRecord(entry)) continue;
        const blob = entry['sha'];
        changes.set(
          String(entry['path']),
          typeof blob === 'string' ? (blobs.get(blob) ?? '') : null,
        );
      }
      const id = commitOn(String(parents[0]), changes);
      return reply(201, {
        sha: id,
        html_url: `https://github.com/o/r/commit/${id}`,
        tree: { sha: `t${id}` },
      });
    }
    if (path.startsWith('/git/refs/heads/') && method === 'PATCH' && isRecord(body)) {
      const next = commits.get(String(body['sha']));
      if (race || next?.parent !== head) {
        race = false;
        return reply(422, { message: 'Update is not a fast forward' });
      }
      head = next.sha;
      return reply(200, { object: { sha: head } });
    }
    if (/^\/commits\/[0-9a-f]+\/status$/.test(path)) {
      return reply(200, {
        state: 'success',
        statuses: [
          { context: 'netlify/ethayer-design/deploy', state: 'success', target_url: null },
        ],
      });
    }
    return reply(404, { message: 'mock: no route' });
  });

  return {
    writes,
    head: () => head,
    file: (p) => fileAt(head, p),
    pushElsewhere(paths) {
      head = commitOn(head, new Map(paths.map((p) => [p, `${fileAt(head, p) ?? ''}\n`])));
    },
    raceOnce() {
      race = true;
    },
  };
}
