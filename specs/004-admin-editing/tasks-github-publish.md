# Tasks 004 · github-publish

Legend as in [001 tasks](../001-timeline-wall/tasks.md). Each task is done when its Acceptance is true **and** `npm run check` passes. Paths under `src/core/github/` and `tests/unit/github/`. Requires `AdminSession` (admin-auth) and the project paths (content-json).

- [x] **T360** Module spec, plan, and tasks written from the approved capability map. → §1–§10
  - Acceptance: the three files exist and follow the map. Owner approval is the spec review gate (plan §5) before T361. Verify: review. Files: `spec-`, `plan-`, `tasks-github-publish.md`
- [x] **T361** Types and recorded-shape fixtures (ref, commit, blob, tree, recursive tree, compare, combined status, error bodies). → FR-361, FR-362, FR-373
  - Acceptance: unions compile under strict and the guards accept every fixture and reject a mutated one. Verify: `npx vitest run tests/unit/github/types`. Files: `types.ts`, `types.test.ts`, `fixtures/*.json`
- [ ] **T362** Path allowlist, path rules, limits, and `checkChanges()`. → FR-363, FR-364
  - Acceptance: hostile paths (`../`, `.github/`, `/abs`, `a\b`, `.env`, a duplicate, a wrong extension) return `invalid`; an 11 MB binary returns `too-large`; 51 changes return `invalid`. Verify: `npx vitest run tests/unit/github/paths`. Files: `paths.ts`, `paths.test.ts`
- [ ] **T363** `mapHttpError()` and rate-limit parsing. → FR-372
  - Acceptance: a table test covers 401, 403 (remaining 0, retry-after, plain, protected branch), 404, 413, 422 (plain, not-fast-forward, rule violation), 429, 500. Verify: `npx vitest run tests/unit/github/errors`. Files: `errors.ts`, `errors.test.ts`
- [ ] **T364** `treeEntries()`, `expandDeletes()`, `toBase64()`; confirm `sha: null` deletion in the GitHub REST docs and note the result in the spec. → FR-365, FR-366
  - Acceptance: deletions emit `sha: null`; delete-dir expands by prefix and drops missing paths; base64 round-trips random bytes and a 10 MB buffer. Verify: `npx vitest run tests/unit/github/tree`. Files: `tree.ts`, `tree.test.ts`, `spec-github-publish.md`
- [ ] **T365** `conflictingPaths()` from a compare response. → FR-369
  - Acceptance: returns `paths-changed` (including a rename via `previous_filename` and a delete-dir prefix), `history-diverged`, `compare-truncated`, or none. Verify: `npx vitest run tests/unit/github/conflict`. Files: `conflict.ts`, `conflict.test.ts`
- [ ] **T366** `commitMessage()` and `withTrailer()`. → FR-371
  - Acceptance: `content: update dmns via admin` + blank line + `Published-With: admin editor`; the trailer is never doubled. Verify: `npx vitest run tests/unit/github/message`. Files: `message.ts`, `message.test.ts`
- [ ] **T367** `fake-github.ts`, `client.ts` request helper, `readHead()`, `readFile()`. → FR-373, FR-374
  - Acceptance: reads decode UTF-8 (including "é"); a 404 maps to `not-found`; a shape mismatch maps to `unknown`; a rejected fetch maps to `network`. Verify: `npx vitest run tests/unit/github/client`. Files: `client.ts`, `client.test.ts`, `fake-github.ts`
- [ ] **T368** `publish()` happy path, `unchanged`, and pre-request rejection. → FR-365, FR-367, FR-368
  - Acceptance: the call order and bodies match the spec (`base_tree`, `parents`, `force: false`); invalid input makes zero calls. Verify: `npx vitest run tests/unit/github/publish`. Files: `publish.ts`, `publish.test.ts`
- [ ] **T369** Rebase, conflict, and race retry with blob reuse. → FR-369, FR-370
  - Acceptance: a moved head with disjoint paths gives `rebased: true`; overlap gives `conflict`; one 422 race retries without re-uploading blobs; two races give `conflict: race`. Verify: `npx vitest run tests/unit/github/publish`. Files: `publish.ts`, `publish-conflict.test.ts`
- [ ] **T370** `deployStateFrom()` and `watchDeploy()`; record which endpoint and context Netlify uses (TO VERIFY). → FR-375
  - Acceptance: with a fake clock it yields queued → building → live, stops on failed, ends `unknown: timeout` at 5 min and `no-access` on 403, and stops on abort. Verify: `npx vitest run tests/unit/github/deploy`. Files: `deploy-state.ts`, `deploy.ts`, `deploy.test.ts`
- [ ] **T371** `index.ts` exports, lint overrides (`no-console`, `no-restricted-imports`), and the public-bundle check. → FR-360, FR-376, FR-377, FR-378
  - Acceptance: only the FR-360 names are exported; importing the module from `src/components/` fails lint; the public entry chunk has no `api.github.com`; the module is ≤ 5 KB gzip. Verify: `npm run check && npm run build && npm run budgets`. Files: `index.ts`, `eslint.config.js`, `scripts/check-budgets.ts`
- [ ] **T372** Security tests: allowlist enforced inside `publish()` and `readFile()`, no console output, and serialized errors contain no file content or headers. → FR-363, FR-376
  - Acceptance: every hostile path is refused at the public API; a console spy records nothing across the whole suite. Verify: `npx vitest run tests/unit/github`. Files: `security.test.ts`
- [ ] **CP4d** Owner reviews the API and tests, and runs a smoke publish (create, update, delete, one media upload) against a scratch repo. Approval unblocks `edit-layer` (T380+).
