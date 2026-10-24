# Plan 004 · content-json

Companions: [spec-content-json.md](./spec-content-json.md) · [tasks-content-json.md](./tasks-content-json.md) · [capability map](./capability-map.md)

## 1. Components

| Component | File(s) | Runs in | Notes |
| --- | --- | --- | --- |
| Data files | `src/content/data/**` | repo | written only through `serialize()` (FR-308) |
| Vocabulary | `themes.ts`, `motifs.ts`, `era-ids.ts` | everywhere | stays TS (FR-302) |
| Issue model | `validate/issue.ts` | pure | `Issue`, `RuleId`, `Severity`, `Validated<T>`, `issue()` builder |
| Readers | `validate/read.ts` | pure | `Reader` over `unknown`: tracks the JSON Pointer, collects issues, rejects unknown keys |
| Project rules | `validate/project.ts` | pure | `validateProject`, per-size `switch` for the media matrix, gallery |
| Document rules | `validate/documents.ts` | pure | eras, site, résumé, `order.json` shape |
| Bundle rules | `validate/composition.ts` | pure | `order` integrity, the `era` ↔ key match, the three warnings, using `buildWallItems` and `projectSequence` from `core/order.ts` |
| Entry | `validate/index.ts` | pure | `validateContent`, re-exports (FR-305) |
| Paths | `paths.ts` | pure | `projectFile`, `CONTENT_FILES`, `serialize` |
| Change plans | `changes.ts` | pure (admin) | `planCreate`, `planUpdate`, `planDelete`, `planReorder` → `ContentChange[]` |
| Loaders | `projects/index.ts`, `eras.ts`, `site.ts`, `resume.ts` | public | `import.meta.glob` / JSON import, one commented cast each |
| FS reader | `scripts/content-fs.ts` | Node | `readRawContent(root)`, `readContext(root)` (manifest keys, `frame-src` origins) |
| Build gate | `scripts/check-content.ts` | Node / Netlify | `run(root): number`, prints issues, exit code |
| Migration | `scripts/migrate-content.ts` | Node, once | TS modules → validated → `serialize` → files |

### Data flow

```
                 ┌──── tests (content-fs) ────┐
data/**.json ────┼──── check-content (build) ─┼──▶ validateContent ──▶ Issue[] / ContentBundle
                 └──── admin (GitHub tree) ───┘          ▲
public bundle: loaders ──▶ typed PROJECTS/ERAS/SITE/RESUME (no validator; build already validated)
```

## 2. Key decisions

1. **Per-file projects plus one `order.json`.** File paths come straight from the slug (needed by `github-publish`). Create and delete each touch exactly two paths, and a reorder touches one. A numeric `order` field in each file was rejected: a reorder would rewrite many files, and gaps or fractional indexes drift. One `projects.json` was rejected too: every edit would touch one large file, and diffs would be noisy.
2. **`era` stays inside each project**, so `Project` doesn't change and a file describes itself. The redundancy with `order.json` is checked by `order` (error).
3. **Validation happens at build and test time, not in the public runtime.** The public bundle trusts the files because `content:check` runs before `vite build`, and a loader ≡ validator test keeps the casts honest. The validator ships only in the admin chunk (target ≤ 5 KB gzip of its 40 KB).
4. **Errors versus warnings** (FR-312). If a rule's failure changes what renders or breaks a constitution rule, it's an error. If it is editorial balance across cards, it's a warning. Tests and the build fail on errors only.
5. **The validator takes facts as input.** The manifest keys and the CSP frame origins arrive in `ctx`, so it stays pure and the editor can include media that is still uploading.
6. **No schema library.** `types.ts` stays the single source of truth. Readers narrow `unknown` with type predicates, and the per-size `switch` lets `tsc` check the matrix.

## 3. Implementation order

1. Paperwork and types (T300–T301): amend specs 001 and 003; add `Site`, `ProjectOrder`, and `ERA_IDS`.
2. Validator, bottom-up (T302–T305): issue model and readers, project rules, document rules, composition and entry. A fixture per rule as each one lands.
3. **Prove it on today's content (T306):** run `validateContent` on the existing TS modules, passed in as `unknown`. Zero errors and zero warnings are required *before* any file moves. This is the check that the rules match the old tests.
4. Migrate (T307): generate the JSON, then `migration.test.ts` (`toStrictEqual` against the TS modules).
5. Switch the loaders (T308) and measure budgets before and after.
6. Build gate (T309), then the change plans for the editor (T310).
7. Clean up (T311–T313): move the overlapping test assertions onto the validator, then delete the migration script, its test, and the TS data modules.

## 4. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| The validator disagrees with the old tests (a lost or stricter rule) | T306 runs it on the legacy content first. The old tests stay until T311. Each old assertion maps to a `RuleId` in FR-313 |
| A loader cast hides drift between the JSON and `types.ts` | `content:check` runs before `vite build`. `content.test.ts` asserts loader output `toStrictEqual` the validator output |
| `exactOptionalPropertyTypes`: JSON or the editor writes `"x": null` or an explicit undefined | `shape` rejects `null` where the types don't allow it. The validator omits absent keys. `toStrictEqual` catches stray `undefined` |
| JSON duplicates values the TS shared as constants (`client`, `role`, `period`), so the bundle grows | Measured in T308. gzip absorbs the repetition, and the expected delta is < 0.5 KB against today's ~19 KB. Over 0.5 KB → stop and ask |
| The validator leaks into the public bundle through an import | T308 check: `grep -l swiss-share dist/assets/*.js` finds nothing. Public modules import only types from `validate/` |
| `media-pipeline` makes the manifest a build output | Contract: the build runs the media step **before** `content:check`. `ctx.mediaKeys` reads the generated manifest. Until then, the committed manifest is used |
| Netlify's Node can't strip types (needs ≥ 22.18) | `engines` already says ≥ 22.18, and `NODE_VERSION = "22"` resolves to the latest 22.x. If it fails, the build fails safe and the last deploy stays |
| Warnings pile up unnoticed | Printed on every build, and shown before Publish by `edit-layer`. The owner decides, which is the point |
| Files over 300 lines (the project rules are the largest) | Media and gallery readers split out of `project.ts` if needed. `wc -l` on every task |

## 5. Verification checkpoints

- **After T306**: the legacy content passes the validator with 0 errors and 0 warnings, and every `RuleId` has a failing fixture.
- **After T308**: `npm run check`, `npm run build`, `npm run budgets`, and `npm run e2e` all pass, with no baseline changes. Initial JS before and after is recorded in the PR.
- **After T309**: editing an `alt` to `""` in a scratch copy makes `npm run content:check` exit 1 with the right line. Restoring it exits 0.
- **After T313**: success criteria 1–5 in the spec. **CP4a** is the owner's review.
