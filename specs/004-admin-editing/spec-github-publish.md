# Spec 004 · github-publish: atomic commits to `main`

| Field | Value |
| --- | --- |
| Status | **Draft (2026-10-24)**: written from the approved [capability map](./capability-map.md). Awaiting the owner's review |
| Owner | Eric Thayer |
| Companions | [plan-github-publish.md](./plan-github-publish.md) · [tasks-github-publish.md](./tasks-github-publish.md) · [capability map](./capability-map.md) (assumptions 2, 6; resolved Q2) · `spec-admin-auth.md` (`AdminSession`) · `spec-content-json.md` (paths, validator) · [constitution](../constitution.md) |

## 1. Objective

Turn a set of file changes (project JSON, media uploads, deletions) into **one atomic commit on `main`** through the GitHub Git Data API, then report the Netlify deploy. The module knows nothing about the UI. It takes changes plus a message and returns a commit or a typed error. The caller (`edit-layer`) has already validated the content with the `content-json` validator.

### Acceptance criteria
- **Given** 3 changes (one JSON put, one image upload, one delete), **when** `publish()` succeeds, **then** `main` gains exactly one commit whose parent is the previous head, and the result is `ok` with its sha and `html_url`.
- **Given** `main` moved since the editor loaded and none of the changed paths were touched, **then** the commit is built on the new head and the result is `ok` with `rebased: true`.
- **Given** `main` moved and one of the changed paths was touched, **then** nothing is written to the ref and the result is `conflict` listing that path.
- **Given** a change outside the allowlist (for example `.github/workflows/ci.yml`), **then** the result is `invalid` and **no request** is made.
- **Given** a successful commit, **then** `watchDeploy()` yields `queued` → `building` → `live` (or `failed`), or `unknown` after 5 minutes, with the deploy log link when GitHub provides one.

## 2. Functional requirements

### Public API (`src/core/github/index.ts`)
- **FR-360** Exactly these exports. `session` is `AdminSession` from `admin-auth`, and every request goes through `session.authorizedFetch`:
  ```ts
  readHead(session: AdminSession): Promise<HeadResult>;                       // { kind: 'ok'; sha } | GitHubError
  readFile(session: AdminSession, path: string, ref: string): Promise<ReadFileResult>; // { kind: 'ok'; text; blobSha } | GitHubError
  publish(session: AdminSession, request: PublishRequest): Promise<PublishResult>;
  watchDeploy(session: AdminSession, commitSha: string, options?: WatchOptions): AsyncIterable<DeployState>;
  commitMessage(action: 'create' | 'update' | 'delete', slug: string): string;
  ```
- **FR-361** Changes and request:
  ```ts
  type FileChange =
    | { readonly kind: 'put'; readonly path: string; readonly content: string }          // UTF-8 text (JSON)
    | { readonly kind: 'put-binary'; readonly path: string; readonly bytes: Uint8Array } // media upload
    | { readonly kind: 'delete'; readonly path: string }                                 // one file
    | { readonly kind: 'delete-dir'; readonly path: string };                            // every file under a folder, e.g. media-src/<slug>/
  interface PublishRequest {
    readonly changes: readonly FileChange[];
    readonly message: string;
    readonly expectedHeadSha: string; // from readHead() when the editor loaded
  }
  ```
- **FR-362** `PublishResult` is the discriminated union in §Code style. `GitHubError` is shared by all four network functions.

### Local checks (pure, before any request)
- **FR-363** **Path allowlist.** `put` paths must match `src/content/data/**/*.json`. `put-binary` paths must match `media-src/<slug>/<file>` with an extension in `.jpg .jpeg .png .webp .avif .mp4 .webm` (the media-pipeline FR-322 set; GIF is rejected there, so it isn't allowed here). `delete` may target either; `delete-dir` only `media-src/<slug>/`. Every path is checked raw: no leading `/`, no `\`, no empty, `.` or `..` segments, no leading-dot segments, each segment `[A-Za-z0-9._-]+`, ≤ 200 characters, and no path appears twice. A violation returns `invalid` with the reason and path. `readFile` applies the same allowlist.
- **FR-364** **Limits.** ≤ 50 changes per publish. Text ≤ 1 MB. Binary ≤ **10 MB** per file (matches `media-pipeline`). ≤ 40 MB of raw bytes per publish. ≤ 300 tree entries after `delete-dir` expansion. A breach returns `too-large` (size) or `invalid` (count) before any request. The constants are exported so the editor can reject a file at pick time.

### One atomic commit (Git Data API)
- **FR-365** Sequence, all on `/repos/{owner}/{name}`: `GET git/ref/heads/main` → `GET git/commits/{head}` (tree sha) → `POST git/blobs` per put (`encoding: 'utf-8'` for text, `'base64'` for binary, at most 3 in flight) → `POST git/trees` with `base_tree` → `POST git/commits` with `parents: [base]` → `PATCH git/refs/heads/main` with `force: false`. Only the final PATCH changes what anyone sees.
- **FR-366** **Deletions** are tree entries `{ path, mode: '100644', type: 'blob', sha: null }`. The docs for "Create a tree" say a `null` sha deletes the path from `base_tree` (high confidence; verify against GitHub REST docs during implementation, including what happens for a path that doesn't exist). `delete-dir` expands to one deletion per file using `GET git/trees/{treeSha}?recursive=1`, filtered by prefix. If `truncated` is true, the result is `unknown`. A deletion of a missing file is dropped, so deletes are idempotent.
- **FR-367** If the new tree sha equals the base tree sha, no commit is made and the result is `unchanged`.
- **FR-368** **Why not the Contents API:** `PUT /contents/{path}` makes one commit per file, has no multi-file transaction, and needs each file's current blob sha. A project create (JSON plus media) would land as several commits and Netlify builds. A failure partway through would leave `main` half-published.

### Conflict policy
- **FR-369** If the current head equals `expectedHeadSha`, build on it. Otherwise call `GET compare/{expected}...{current}`:
  - `status` is not `ahead` (history rewritten) → `conflict`, reason `history-diverged`.
  - `files` has 300 entries (the API cap, so the list may be truncated) → `conflict`, reason `compare-truncated`.
  - any `filename` or `previous_filename` equals a changed path, or falls under a `delete-dir` prefix → `conflict`, reason `paths-changed`, listing those paths.
  - otherwise → rebase: build the tree on the current head, and return `rebased: true`.
- **FR-370** **Race on the ref.** If the PATCH returns 422 with "not a fast forward" (wording to verify against GitHub REST docs), retry once from `GET ref`, keeping the original `expectedHeadSha` and reusing the blob shas already created (blobs are content-addressed). A second race returns `conflict`, reason `race`. The module never sends `force: true`.

### Messages, errors, and limits
- **FR-371** `commitMessage(action, slug)` returns `content: <action> <slug> via admin`. `publish()` appends a blank line and the trailer `Published-With: admin editor` unless the message already has it. The author and committer are the token's user (the GitHub default; no `author` field is sent).
- **FR-372** **HTTP mapping** (pure `mapHttpError(status, headers, body)`): 401 → `unauthorized` (admin-auth also signs out). 403 or 429 with `x-ratelimit-remaining: 0` → `rate-limited` with `resetAt` from `x-ratelimit-reset` (epoch s → ms). 403 or 429 with `retry-after` → `rate-limited` at now + retry-after. Other 403 → `forbidden` (`missing-permission`). 403 or 422 on the ref PATCH whose message mentions a protected branch or a rule violation → `forbidden` (`branch-protected`; wording to verify). 404 → `not-found`. 413 → `too-large`. Other 422 → `validation-rejected` with GitHub's `message`. A `fetch` rejection → `network`. Anything else → `unknown` with the status.
- **FR-373** Responses are parsed as `unknown` and narrowed by type guards per endpoint. A shape mismatch → `unknown` (status 0). No `any`, no casts.

### Reads
- **FR-374** `readHead` returns the `main` sha. `readFile(path, ref)` calls `GET contents/{path}?ref={ref}` (segments URI-encoded), base64-decodes to UTF-8 with `TextDecoder`, and returns the text plus its blob sha. A 404 means the file doesn't exist (a new project). The editor calls `readHead` first and passes that sha as `ref` so the file and `expectedHeadSha` agree. Files over 1 MB come back without content (verify against GitHub REST docs) → `too-large`.

### Deploy status
- **FR-375** `watchDeploy` polls `GET commits/{sha}/status` (combined status) immediately and then every 10 s for up to 5 min, and yields a state only when it changes. It picks the status whose `context` matches `/netlify/i`: none yet → `queued`, `pending` → `building`, `success` → `live`, `failure` or `error` → `failed`. Each state carries `logUrl` from `target_url` (or `null`). It ends after `live`, `failed`, or `unknown` (`timeout`, `no-access` on 403/404, or `error`). An `AbortSignal` stops it. **TO VERIFY:** whether Netlify reports production deploys as commit statuses, under which context (`deploy/netlify` or `netlify/<site>/…`), or only as check runs. If it's only check runs, T370 switches to `GET commits/{sha}/check-runs` behind the same `DeployState` type:
  ```ts
  type DeployState =
    | { readonly kind: 'queued' | 'building' | 'live' | 'failed'; readonly logUrl: string | null }
    | { readonly kind: 'unknown'; readonly reason: 'timeout' | 'no-access' | 'error' };
  ```

### Security and isolation
- **FR-376** Nothing in `src/core/github/` logs (`no-console` in lint). Error results carry only status, GitHub's `message`, reason codes, and paths. They never carry file contents, bytes, or headers. The token never enters this module, because `authorizedFetch` adds it.
- **FR-377** The module is imported only by the admin chunk. Lint blocks imports of `src/core/github/` from public code, and a build check fails if the public entry chunk contains `api.github.com` or `git/refs`.
- **FR-378** The module's own gzip size is ≤ 5 KB, inside the admin chunk's 40 KB budget.
- **FR-379** Reserved.

## 3. Tech stack
TypeScript 6 strict, `fetch` (through `authorizedFetch`), `TextEncoder`/`TextDecoder`, `btoa`/`atob` with chunked base64 for `Uint8Array` (`Uint8Array.prototype.toBase64` when present). Zero runtime dependencies, no Octokit (constitution II.2). Vitest for tests.

## 4. Commands
`npm run check` (typecheck, lint, unit) · `npx vitest run tests/unit/github` · `npm run build && npm run budgets` (admin chunk size and the FR-377 check).

## 5. Project structure
```
src/core/github/
  types.ts         FileChange, PublishRequest, results, DeployState, wire-shape guards
  paths.ts         allowlist, path rules, limits, checkChanges()        (pure)
  errors.ts        mapHttpError(), rate-limit header parsing            (pure)
  tree.ts          treeEntries(), expandDeletes(), toBase64()           (pure)
  conflict.ts      conflictingPaths(compare, changes)                   (pure)
  message.ts       commitMessage(), withTrailer()                       (pure)
  deploy-state.ts  deployStateFrom(combinedStatus)                      (pure)
  client.ts        request helper, readHead(), readFile()               (fetch)
  publish.ts       publish() orchestration and retry                    (fetch)
  deploy.ts        watchDeploy() polling iterator                       (fetch)
  index.ts         public exports only
tests/unit/github/  *.test.ts, fake-github.ts (scripted fetch), fixtures/*.json
```

## 6. Code style
Each file ≤ 300 lines, explicit return types, results instead of thrown errors:
```ts
export type PublishResult =
  | { readonly kind: 'ok'; readonly commitSha: string; readonly commitUrl: string; readonly rebased: boolean }
  | { readonly kind: 'unchanged'; readonly headSha: string }
  | { readonly kind: 'conflict'; readonly reason: 'paths-changed' | 'history-diverged' | 'compare-truncated' | 'race';
      readonly paths: readonly string[]; readonly headSha: string }
  | { readonly kind: 'invalid'; readonly reason: InvalidReason; readonly path: string | null }
  | { readonly kind: 'too-large'; readonly path: string | null; readonly limitBytes: number }
  | GitHubError;

export type GitHubError =
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'forbidden'; readonly reason: 'missing-permission' | 'branch-protected' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'validation-rejected'; readonly message: string }
  | { readonly kind: 'rate-limited'; readonly resetAt: number }
  | { readonly kind: 'network' }
  | { readonly kind: 'unknown'; readonly status: number };
```

## 7. Testing strategy
- Unit tests for every pure function, using fixtures shaped like the GitHub REST docs' example responses (ref, commit, blob, tree, compare, combined status, error bodies with rate-limit headers).
- `fake-github.ts` stands in for `authorizedFetch`: a script of `{ method, path } → response`. It records calls so tests assert order, bodies (`sha: null`, `force: false`, `parents`), and that invalid input makes **zero** calls.
- Scenarios: happy path, rebase, each conflict reason, race then success, race twice, each HTTP mapping, delete-dir expansion, unchanged tree, deploy timeline with a fake clock.
- No live network in CI. A manual smoke publish against a scratch repo happens at CP4d.

## 8. Boundaries
- **Always:** check paths and limits before any request · use `force: false` · return results, never throw · keep contents and headers out of errors · inject fetch through the session.
- **Ask first:** widening the allowlist · raising limits · publishing to anything but `main` · adding check-runs or a Netlify API call.
- **Never:** `force: true` · the Contents API for writes · logging · importing UI or `content-json` validation code · a runtime dependency · shipping in the public bundle.

## 9. Success criteria
All acceptance criteria are covered by unit tests. `npm run check` passes. A publish with N puts makes 5 + N requests (+1 compare when rebasing, +1 tree read for `delete-dir`). The public bundle doesn't change size. The module is ≤ 5 KB gzip.

## 10. Open questions
1. **Token permissions.** Commit statuses need "Commit statuses: read" on the fine-grained token. Should `admin-auth` ask for it, or do we accept `unknown` deploy status?
2. **Netlify reporting.** Commit status or check run for production deploys, which context, and the site name for a fallback "open Netlify deploys" link?
3. **Branch protection.** Are there branch protection rules or rulesets on `main` today? Any rule that requires a PR blocks this module.
4. **Limits.** Are 10 MB per file and 50 changes enough? Raw video clips may be larger.
5. **Smoke repo.** Can the owner create a scratch repo (for example `ericthayer/admin-sandbox`) for the CP4d live test?

## Implementation notes
- FR-372: a 403 whose message mentions a rate limit but has no limit headers (a secondary limit), and a bare 429, map to `rate-limited` at now + 60 s, GitHub's documented minimum wait.
- FR-372: `mapHttpError` returns `GitHubError | TooLarge`, since `too-large` isn't a `GitHubError`. A 413 carries `path: null` and the per-file cap as `limitBytes`. `readHead` reports a 413 as `unknown` (413).
- FR-370: the race test matches "not a fast forward" and "Reference cannot be updated" (TO VERIFY at CP4d). Both are safe to retry, because the retry re-reads the head and re-checks for conflicts.
