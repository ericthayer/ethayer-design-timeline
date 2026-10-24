# Plan 004 · github-publish

How [spec-github-publish.md](./spec-github-publish.md) gets built. Every rule in the [constitution](../constitution.md) applies. Starts after `admin-auth` exposes `AdminSession` and `content-json` fixes the project file paths (capability map build order).

## 1. Components

| File | Kind | Responsibility | FR |
| --- | --- | --- | --- |
| `types.ts` | types | `FileChange`, `PublishRequest`, result unions, `DeployState`, wire-shape type guards | 361, 362, 373 |
| `paths.ts` | pure | allowlist, path rules, limit constants, `checkChanges()` | 363, 364 |
| `errors.ts` | pure | `mapHttpError()`, rate-limit headers, branch-protection detection | 372 |
| `tree.ts` | pure | `treeEntries()` (blob shas + `sha: null`), `expandDeletes()`, `toBase64()` | 365, 366 |
| `conflict.ts` | pure | `conflictingPaths()` from a compare response | 369 |
| `message.ts` | pure | `commitMessage()`, `withTrailer()` | 371 |
| `deploy-state.ts` | pure | `deployStateFrom()` from a combined status | 375 |
| `client.ts` | fetch | `request()` (JSON parse + guard + error map), `readHead()`, `readFile()` | 373, 374 |
| `publish.ts` | fetch | the commit sequence, rebase decision, one retry, blob reuse | 365–370 |
| `deploy.ts` | fetch | `watchDeploy()` async generator, injected `sleep`/`now`, `AbortSignal` | 375 |
| `index.ts` | exports | the FR-360 surface only | 360 |

## 2. Publish flow

```
checkChanges(request)            ── invalid / too-large → return (no request)
loop attempt 1..2:
  head  = GET git/ref/heads/main
  if head ≠ expected:
    cmp = GET compare/{expected}...{head}
    conflictingPaths(cmp, changes) ── conflict → return
  commit = GET git/commits/{head}           → baseTree
  if any delete-dir: GET git/trees/{baseTree}?recursive=1 → expandDeletes()
  blobs  = POST git/blobs (≤ 3 in flight, cached by path across attempts)
  tree   = POST git/trees { base_tree, tree: treeEntries() }
  if tree.sha == baseTree → unchanged
  new    = POST git/commits { message: withTrailer(), tree, parents: [head] }
  PATCH git/refs/heads/main { sha: new, force: false }
    ok → return ok { rebased: head ≠ expected }
    422 not-fast-forward → next attempt (2nd time → conflict 'race')
```

## 3. Order

1. Types and fixtures first, so every later test has its shapes.
2. Pure modules (paths, errors, tree, conflict, message): each with its tests, no network.
3. `client.ts` and the fake GitHub, then `readHead`/`readFile`.
4. `publish.ts` happy path, then rebase, conflict, and race.
5. Deploy status (pure mapping, then the poller).
6. Exports, lint rules, the bundle isolation check, and security tests.
7. CP4d: owner review plus a live smoke test against a scratch repo.

## 4. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| A failure between `POST blobs` and `PATCH ref` (network drop, tab closed) | Harmless: blobs, trees, and commits nobody references are orphaned objects that GitHub garbage-collects. `main` changes only at the PATCH, so the site is never half-published. The editor keeps its local draft and can retry |
| Branch protection or a ruleset on `main` rejects `PATCH ref` | `mapHttpError` detects a protected-branch or rule-violation message (403 or 422 on the ref) and returns `forbidden: branch-protected`. The editor explains that `main` requires PRs and the owner must allow direct pushes for their account. Open question 3 |
| `sha: null` deletion behaves differently than documented (for example, an error on a missing path) | T364 verifies it against the GitHub REST docs. `expandDeletes()` drops paths absent from the base tree, so we never send a deletion for a missing path |
| Compare is truncated (300 files) or history was rewritten | Treated as a conflict, never a silent rebase |
| Netlify doesn't post commit statuses for production deploys | `watchDeploy` ends with `unknown` and the editor still shows "Published". Switching to check runs is isolated in `deploy-state.ts` + `deploy.ts` |
| Fine-grained token lacks "Commit statuses: read" | 403/404 → `unknown: no-access` right away, with no retry loop |
| Large base64 bodies (a 10 MB file is about 13.4 MB as base64) are slow on weak links | 10 MB per-file cap, 40 MB per publish. The editor shows per-file progress through the change list order |
| Rate limiting during a 5-minute poll | 30 polls at most, far below 5,000/h. A `rate-limited` result stops polling with `unknown` |
| A bug writes outside content (workflows, code) | The allowlist is checked in `publish()` itself, before any request, and tested with hostile paths (`../`, `.github/`, `%2e%2e`, backslashes, a duplicate) |
| Token or content leaks into logs | `no-console` lint override for `src/core/github/`. Error results have no body or header fields. Tests serialize every error result and assert no fixture content appears |
| The module leaks into the public bundle | `no-restricted-imports` outside the admin entry, and a build check grep on the public entry chunk |

## 5. Checkpoints

- **Spec review:** the owner approves `spec-github-publish.md` and answers its open questions before T361.
- **CP4d:** after T372. The owner reviews the tests and the API, and runs one smoke publish (create, update, delete) against a scratch repo. Nothing in this module publishes to the real `main` before CP4d is approved.
