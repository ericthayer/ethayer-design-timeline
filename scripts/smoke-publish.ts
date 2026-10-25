// CP4d live smoke publish (spec 004 github-publish): runs the real publish(), readFile() and
// watchDeploy() against a scratch repo. Create (JSON plus one image), update, then delete.
//
//   ADMIN_SANDBOX_TOKEN=github_pat_… node scripts/smoke-publish.ts
//
// The token is fine-grained, scoped to the scratch repo only, with Contents: Read and write and
// Commit statuses: Read-only. SMOKE_REPO overrides the default `ericthayer/admin-sandbox`.
// The script refuses to run against the site's own repo. It never prints the token.
import { readFileSync } from 'node:fs';
import { resolveApiUrl, type AdminSession } from '../src/core/auth/session.ts';
import { apiInit } from '../src/core/auth/verify.ts';
import { REPO } from '../src/core/auth/config.ts';
import { PROJECTS_DIR } from '../src/content/paths.ts';
import { SOURCE_ROOT } from '../src/core/media-rules.ts';
import {
  commitMessage,
  publish,
  readFile,
  readHead,
  watchDeploy,
  type FileChange,
  type PublishResult,
} from '../src/core/github/index.ts';

const SLUG = 'smoke-test';
const JSON_PATH = `${PROJECTS_DIR}/${SLUG}.json`;
const MEDIA_DIR = `${SOURCE_ROOT}/${SLUG}/`;
const IMAGE_PATH = `${MEDIA_DIR}cover.png`;
/** Any small PNG in the repo will do; this one is 1200×630, about 14 KB. */
const IMAGE_SOURCE = 'public/og/home.png';

function fail(message: string): never {
  console.error(`✘ ${message}`);
  process.exit(1);
}

function targetRepo(): { owner: string; name: string } {
  const raw = process.env['SMOKE_REPO'] ?? 'ericthayer/admin-sandbox';
  const [owner, name, extra] = raw.split('/');
  if (!owner || !name || extra !== undefined) fail(`SMOKE_REPO must be owner/name, got "${raw}"`);
  if (owner.toLowerCase() === REPO.owner && name.toLowerCase() === REPO.name) {
    fail(`refusing to smoke-publish to the site repo ${raw}; use a scratch repo`);
  }
  return { owner, name };
}

function sandboxSession(token: string): AdminSession {
  const repo = targetRepo();
  return Object.freeze({
    login: repo.owner,
    repo: Object.freeze({ ...repo, branch: 'main' as const }),
    expiresAt: null,
    authorizedFetch: (path: `/${string}`, init: RequestInit = {}): Promise<Response> =>
      fetch(resolveApiUrl(path).href, apiInit(token, init)),
  });
}

function projectJson(summary: string): string {
  const project = { slug: SLUG, title: 'Smoke Test — café', summary, draft: true };
  return `${JSON.stringify(project, null, 2)}\n`;
}

/** Publishes one step and returns its commit sha, or exits with the result kind. */
async function step(
  session: AdminSession,
  label: string,
  head: string,
  changes: readonly FileChange[],
  action: 'create' | 'update' | 'delete',
): Promise<string> {
  const result: PublishResult = await publish(session, {
    changes,
    message: commitMessage(action, SLUG),
    expectedHeadSha: head,
  });
  if (result.kind !== 'ok') fail(`${label}: ${JSON.stringify(result)}`);
  console.log(`✔ ${label}: ${result.commitUrl}${result.rebased ? ' (rebased)' : ''}`);
  return result.commitSha;
}

async function expectJson(session: AdminSession, ref: string, expected: string): Promise<void> {
  const read = await readFile(session, JSON_PATH, ref);
  if (read.kind !== 'ok') fail(`read back ${JSON_PATH}: ${JSON.stringify(read)}`);
  if (read.text !== expected) fail(`read back ${JSON_PATH}: content differs from what was sent`);
  console.log(`  read back ${JSON_PATH} at ${ref.slice(0, 7)}: matches (UTF-8 "é" intact)`);
}

async function main(): Promise<void> {
  const token = process.env['ADMIN_SANDBOX_TOKEN']?.trim();
  if (!token) fail('set ADMIN_SANDBOX_TOKEN to a fine-grained token for the scratch repo');
  if (!token.startsWith('github_pat_')) fail('ADMIN_SANDBOX_TOKEN must be a fine-grained token');
  const session = sandboxSession(token);
  const { owner, name } = session.repo;
  console.log(`Smoke publish against ${owner}/${name}`);

  const head = await readHead(session);
  if (head.kind !== 'ok') fail(`read main: ${JSON.stringify(head)}`);
  console.log(`  main is at ${head.sha.slice(0, 7)}`);

  const created = projectJson('Created by scripts/smoke-publish.ts.');
  const image = new Uint8Array(readFileSync(IMAGE_SOURCE));
  const c1 = await step(
    session,
    'create (JSON + image)',
    head.sha,
    [
      { kind: 'put', path: JSON_PATH, content: created },
      { kind: 'put-binary', path: IMAGE_PATH, bytes: image },
    ],
    'create',
  );
  await expectJson(session, c1, created);

  const updated = projectJson('Updated by scripts/smoke-publish.ts.');
  const c2 = await step(
    session,
    'update (JSON)',
    c1,
    [{ kind: 'put', path: JSON_PATH, content: updated }],
    'update',
  );
  await expectJson(session, c2, updated);

  const c3 = await step(
    session,
    'delete (JSON + media folder)',
    c2,
    [
      { kind: 'delete', path: JSON_PATH },
      { kind: 'delete-dir', path: MEDIA_DIR },
    ],
    'delete',
  );
  const gone = await readFile(session, JSON_PATH, c3);
  if (gone.kind !== 'not-found') fail(`after delete, expected not-found, got ${gone.kind}`);
  console.log(`  ${JSON_PATH} is gone at ${c3.slice(0, 7)}`);

  // No Netlify on the scratch repo: expect `queued`, then `unknown: timeout`. `no-access` means
  // the token lacks Commit statuses: Read-only.
  const states: string[] = [];
  for await (const state of watchDeploy(session, c3, { intervalMs: 5_000, timeoutMs: 12_000 })) {
    states.push(state.kind === 'unknown' ? `unknown: ${state.reason}` : state.kind);
  }
  console.log(`✔ deploy status reads: ${states.join(' → ')}`);
  console.log('Smoke publish passed.');
}

await main();
