# Spec 004 · content-json: JSON content and the shared validator

| Field | Value |
| --- | --- |
| Status | **Draft (2026-10-24)**: from the approved [capability map](./capability-map.md). Awaiting CP4a |
| Owner | Eric Thayer |
| Supersedes | [001 plan](../001-timeline-wall/plan.md) ADR-7 (typed TS content modules). Amends [001 spec](../001-timeline-wall/spec.md) FR-011b and FR-091, G4; [003 spec](../003-batch-b-and-gallery/spec.md) FR-220 (see FR-318) |
| Companions | [plan-content-json.md](./plan-content-json.md) · [tasks-content-json.md](./tasks-content-json.md) · [data-model](../001-timeline-wall/data-model.md) · [constitution](../constitution.md) |

## 1. Objective

The browser editor (`edit-layer`) can't write TypeScript modules safely, so content moves to JSON files with **one** hand-written validator. The validator is pure TS (no DOM, no `node:*`). Unit tests, the Netlify build, and the editor all call it, so a rule is written once. Bad content fails `npm run build`, and Netlify keeps the last good deploy. The rest of the app keeps its types from `types.ts`: the validator replaces `satisfies`.

### US20 (P1). The live site never changes on bad content
- **Given** a project file with an error (a missing alt, an iframe on an `sm` card, an unknown theme), **when** Netlify runs `npm run build`, **then** the build exits non-zero and prints `error <file> <pointer> <rule>: <message>` for each issue.
- **Given** content with only warnings, **then** the build passes and prints the warnings.

### US21 (P1). Add, edit, and delete a project as files
- **Given** a new project, **then** it is one new file `src/content/data/projects/<slug>.json` plus one change to `order.json`.
- **Given** a deleted project, **then** its file is removed and its slug leaves `order.json` in the same change set. No other file names a slug, so nothing dangles.
- **Given** a reorder inside an era, **then** only `order.json` changes.

### US22 (P1). The migration changes nothing visible
- **Given** the migrated JSON, **then** `buildWallItems(PROJECTS, ERAS)`, `SITE`, and `RESUME` are deep-equal to the TS-module versions, and the e2e suite passes with no baseline changes.

## 2. Functional requirements

### Layout and loading
- **FR-300** Content lives under `src/content/data/`:

| Path | Holds | Type after validation |
| --- | --- | --- |
| `projects/<slug>.json` | one project; file name = `slug` | `Project` |
| `order.json` | `{ "<EraId>": ["<slug>", …] }`, curated order within each era | `ProjectOrder` |
| `eras.json` | eras, newest `period.start` first | `readonly [Era, ...Era[]]` |
| `site.json` | identity, links, education (today's `SITE`) | `Site` (new in `types.ts`) |
| `resume.json` | today's `RESUME` | `Resume` |

- **FR-301** Order is stored **only** in `order.json`. Era order stays derived from `period.start` (FR-001). Each project still carries `era`, and the validator requires it to match the key it is listed under.
- **FR-302** `themes.ts`, `motifs.ts`, and a new `era-ids.ts` (`ERA_IDS`, with `EraId` derived from it) stay TS. They are vocabulary bound to code (`tokens.css`, the motif registry, the era union), not content.
- **FR-303** The existing modules keep their exports and become thin loaders: `projects/index.ts` (`PROJECTS`, via `import.meta.glob('../data/projects/*.json', { eager: true })`, sequenced by `order.json`), `eras.ts`, `site.ts`, and `resume.ts` (still reached only through dynamic `import()`, FR-122). Each loader has one cast, commented "validated by content:check (FR-310)". A unit test proves each loader's output deep-equals the validator's output (FR-316).
- **FR-304** The public bundle **never** includes the validator. It runs in tests, in `scripts/check-content.ts`, and in the admin chunk.

### Validator interface (other modules import only this)
- **FR-305** `src/content/validate/index.ts` exports `validateContent(raw: RawContent, ctx: ValidationContext): Validated<ContentBundle>`, `validateProject(raw: unknown, file: string, ctx): Validated<Project>` (live, per-file feedback), and the types `Issue`, `RuleId`, `Severity`, `Validated`, `RawContent`, `ValidationContext`, and `ContentBundle`. `RawContent` holds parsed JSON as `unknown`, keyed by repo path. `ValidationContext` is `{ mediaKeys: ReadonlySet<string> | null; videoKeys: ReadonlySet<string> | null; frameOrigins: readonly string[] }`. `null` skips that manifest check. `videoKeys` answers media-pipeline MQ6.
- **FR-306** `Issue = { severity, rule, file, path, slug, message }`. `file` is the repo path, `path` is an RFC 6901 JSON Pointer (`/gallery/2/label`), `slug` is `string | null`, and `message` is plain text that names the value and the limit. `Validated<T>` is a union on `ok`: there is `value` only when `ok: true`, and `errors` only when `ok: false`. Both carry `warnings`.
- **FR-307** Output objects are rebuilt field by field in `types.ts` order. Unknown keys are errors, and absent optional keys are omitted, never set to `undefined` (`exactOptionalPropertyTypes`).
- **FR-308** `src/content/paths.ts` exports `projectFile(slug)` → `src/content/data/projects/${slug}.json`, `CONTENT_FILES` (`order`, `eras`, `site`, `resume`), and `serialize(value): string` (`JSON.stringify(v, null, 2) + '\n'`). Every write uses `serialize`. `src/content/data/` goes in `.prettierignore`.
- **FR-309** `src/content/changes.ts` exports `planCreate(raw, project, at)`, `planUpdate(raw, slug, project)`, `planDelete(raw, slug)`, and `planReorder(raw, era, slugs)`. Each validates the **resulting** bundle and returns `Validated<readonly ContentChange[]>`, where `ContentChange = { kind: 'put'; path; content } | { kind: 'delete'; path }`. That is a structural subset of `github-publish`'s `FileChange` (its FR-361), so `edit-layer` passes it straight through without content-json importing that module. A plan with errors yields no changes. `planCreate`'s `at` is the zero-based index within the project's era in `order.json` (0 = top of the era; an index past the end appends). `planUpdate` rejects a slug change (rule `slug`). Moving a project to another era also moves it in `order.json`, to the top of the new era.

### Build gate
- **FR-310** `npm run content:check` (`node scripts/check-content.ts`) reads the files with `node:fs`, builds `ctx` (keys from `media-manifest.json` and `video-manifest.json`, or `null` for a missing file, and `frameOrigins` from the `frame-src` in `netlify.toml`), prints every issue, and exits 1 if there is any error. `build` becomes `tsc --noEmit && npm run content:check && vite build`, and `media-pipeline` puts `npm run media && ` in front of it (its FR-331).
- **FR-311** Invalid JSON is an error (`json-parse`), with the file and the parser message.

### Rules
- **FR-312** Severity policy. **Errors** are rules about one file or one reference that, if broken, would render wrongly, crash, or break a constitution rule (types, a11y, CSP). **Warnings** are editorial composition rules across projects. The site still renders correctly and accessibly when one fails, and the fix is often a *different* project than the one being edited. Blocking those would trap the owner: deleting two of today's seven Swiss cards drops the share to 5/26 = 19 %, and a delete can't be "fixed" in place.
- **FR-313** Rule table (`RuleId` is this union):

| Rule | Sev. | Check | From |
| --- | --- | --- | --- |
| `json-parse` | error | the file parses | — |
| `shape` | error | required fields, types, enum values (size, layout, treatment, engagement, media kind, variant, viewport, link kind, span) | ADR-7 types |
| `unknown-key` | error | no keys outside `types.ts` | — |
| `slug` | error | kebab-case, equals the file name, immutable on update | FR-091 |
| `text-length` | error | title `sm` ≤ 24 and others ≤ 40, summary ≤ 160, track list ≤ 8 | FR-091 |
| `size-media` | error | the size × media matrix (data-model §2): no iframe on `sm`, `tall` takes `mobile` only, `wide`/`feature` take `desktop` only | FR-035 |
| `gallery-media` | error | no iframe in a gallery | FR-211 |
| `a11y-text` | error | non-empty alt on every image and poster; non-empty video label, iframe title, gallery label | FR-091, FR-210 |
| `placeholder-caption` | error | placeholder gallery labels start with `Placeholder ·` | FR-220 |
| `focal-format` | error | `^\d{1,3}% \d{1,3}%$` | FR-213 |
| `period` | error | `YYYY-MM` with a real month, and `start ≤ end` (projects, eras, résumé roles, site span) | FR-091 |
| `era-ref` | error | `project.era` and `eras.json` ids are in `ERA_IDS`; eras are unique and newest first | FR-091; hero "Now" reads `ERAS[0]` |
| `theme-name` / `motif-name` | error | in `THEMES` (each is contrast-tested in `contrast.test.ts`) / in `MOTIFS` | FR-015, FR-201 |
| `url` | error | `https://` for links, iframes, and résumé `href`; site links are `/resume`, `https://`, or `mailto:`; captions match `/media/*.vtt` | types |
| `iframe-host` | error | the iframe origin is in `ctx.frameOrigins` | FR-091, VII |
| `media-key` | error | image and poster `src` in `ctx.mediaKeys`, video `src` in `ctx.videoKeys` (each skipped when `null`) | FR-091, MQ6 |
| `video-duration` | error | card video `durationSec` ≤ 8 | FR-031 |
| `order` | error | every project file is listed exactly once, under its own `era`; no listed slug lacks a file; keys are `EraId`s | FR-301 |
| `swiss-share` | warning | Swiss share is 20–30 % of projects | FR-011b |
| `standard-run` | warning | no more than 7 standard cards in a row (wall sequence) | FR-011b |
| `swiss-motif-unique` | warning | no two Swiss cards share a motif | US11 |

- **FR-314** Checks that need the file system stay out of the validator: optimized image and video files on disk stay in `content.test.ts` until `media-pipeline` takes them over.

### Migration and tests
- **FR-315** `scripts/migrate-content.ts` is a one-time script. It imports the TS modules, validates them, and writes the JSON with `serialize`. It is deleted after the migration, in T312.
- **FR-316** Tests: one fixture per `RuleId` (a `Record<RuleId, Fixture>`, so the compiler forces full coverage); loader ≡ validator; the real content has zero errors; and `changes.ts` round-trips.
- **FR-317** A temporary `migration.test.ts` asserts that `buildWallItems`, `ERAS`, `SITE`, and `RESUME` from the JSON are `toStrictEqual` to the TS modules. It is deleted with them, after it has passed in CI.
- **FR-318** `gallery.test.ts` drops the FR-220 "exactly these five slugs" snapshot, because the owner now adds galleries. The other gallery rules move into the validator.

## 3. Tech stack

TypeScript 6 strict, Vite 8 (`import.meta.glob`, JSON modules), Vitest 5, and Node ≥ 22.18 type stripping for scripts. **No new dependencies**, runtime or dev. A JSON-schema library (Ajv and others) would add a dev dependency, a second source of truth beside `types.ts`, and weaker messages for cross-field rules, which are most of the rules here.

## 4. Commands

| Command | Does |
| --- | --- |
| `npm run content:check` | validates `src/content/data/**`, exits 1 on any error (new) |
| `npm run build` | `tsc --noEmit && npm run content:check && vite build` (changed) |
| `node scripts/migrate-content.ts` | one-time TS → JSON (removed in T312) |
| `npm run check` | typecheck, lint, and unit tests, including validator and content tests |
| `npm run build && npm run budgets` | budget gate. Initial JS ≤ 25 KB gzip |
| `npm run e2e` | must pass with no baseline updates |

## 5. Project structure

```
src/content/data/{projects/<slug>.json, order.json, eras.json, site.json, resume.json}
src/content/validate/{index,issue,read,project,documents,composition}.ts   (each ≤ 300 lines)
src/content/{paths,changes,era-ids}.ts
scripts/{check-content,content-fs}.ts      content-fs: node:fs reader shared with tests
tests/unit/{validate,changes,migration}.test.ts  + tests/fixtures/content/
```

## 6. Code style

```ts
const FOCAL = /^\d{1,3}% \d{1,3}%$/;
const isFocal = (s: string): s is Focal => FOCAL.test(s);

function readFocal(r: Reader, key: string): Focal | undefined {
  const raw = r.optionalString(key);
  if (raw === undefined || isFocal(raw)) return raw;
  r.error('focal-format', key, `"${raw}" must look like "30% 40%"`);
  return undefined;
}
```

Readers take `unknown` and narrow it with type predicates, never `as`. A per-size `switch` builds `Project`, so the compiler checks the size × media matrix. No `any`, and every function declares its return type.

## 7. Testing strategy

Unit tests (Vitest, no DOM) are the main net. There is a fixture per rule, with assertions on `rule`, `severity`, `file`, `path`, and `slug`. The real content goes through `content-fs` and `validateContent`. Loader equivalence, `changes.ts` cases (create, delete of the last Swiss card → warning only, a dangling slug → `order` error), and the temporary migration equivalence complete it. `check-content.ts` exports `run(root): number` and is tested against `tests/fixtures/content/bad/`. e2e and visual tests are unchanged and are the proof that the migration is invisible.

## 8. Boundaries

- **Always**: put each rule in the validator only; keep the validator free of DOM and `node:*`; write files with `serialize`; cite FR ids in tests.
- **Ask first**: changing a rule's severity, adding a rule that today's content fails, changing the JSON layout or paths after `github-publish` and `edit-layer` build on them, or adding any dependency.
- **Never**: import the validator from public code; put order anywhere but `order.json`; update a visual baseline; hand-edit generated JSON during the migration task.

## 9. Success criteria

1. `npm run check`, `npm run build`, `npm run budgets`, and `npm run e2e` pass, with no baseline changes.
2. Removing an `alt` makes `npm run content:check` exit 1 with a line naming the file, `/media/alt`, and `a11y-text`.
3. Initial public JS grows by ≤ 0.5 KB gzip, and no `dist/assets/*.js` contains the string `swiss-share`.
4. Every `RuleId` has a fixture test. `planDelete` never leaves a slug in `order.json` without a file.
5. No `src/content/projects/*.ts` data modules remain. `index.ts` is the only loader.

## 10. Open questions

1. **Slug rename.** v1 treats a slug as immutable (a rename is delete plus create, and old `/work/<slug>` links show "Project not found"). Is that acceptable, or should v1 support renames?
2. **Warnings in the editor.** Should Publish with warnings need an explicit confirmation (proposed), or just show them?
3. **Delete and media.** `planDelete` returns only content changes. `edit-layer` should add `{ kind: 'delete-dir', path: 'media-src/<slug>/' }` to the same publish, so no orphaned raw media stays behind (orphans are harmless to the build). Agreed?
4. **v2 eras.** Adding an era means editing `ERA_IDS` in code. Should it become a validated string in v2?

## Implementation notes

- FR-309: each plan function takes a trailing `ctx: ValidationContext` (`planCreate(raw, project, at, ctx)` and so on), because validating the resulting bundle needs the manifest keys and frame origins.
- FR-309: `project` is typed `unknown`, so the editor can pass a draft that is not yet a valid `Project`.
- FR-311: an unparsable file is carried in `RawContent` as a `JsonParseFailure` (from `parseJson(text)`), and `validateContent` reports it as `json-parse`. Both are exported from `validate/index.ts` with `RULE_IDS` and `severityOf`.
- FR-307: project files follow `types.ts` order literally: the `ProjectBase` fields, then `size` and `media` last.
- §5: the media and poster readers live in `validate/media.ts` (allowed by the plan's 300-line risk row).
- FR-313 `era-ref` also requires `project.era` to be an id in `eras.json` (the old "references real eras" test). A missing document is a `shape` error at the file root. `artwork` media in a gallery is a `gallery-media` error, like an iframe. A Vimeo `title` must be non-empty (`a11y-text`).
- FR-303: `eras.ts` casts through `unknown` (`as unknown as readonly [Era, ...Era[]]`), because a JSON array has no tuple type. The other loaders use a single `as`, and `projects/index.ts` uses the `import.meta.glob<Project>` type argument.
- FR-310: `check-content.ts` prints the whole-file pointer `''` as `(root)`, and `run(root, log?)` takes an optional logger for tests.
- T308: initial JS (gzip) went from 19,507 B to 19,988 B (+481 B, under the 0.5 KB limit). No `dist/assets/*.js` contains `swiss-share`.
- FR-317: `migration.test.ts` compared `ERAS`, `SITE`, and `RESUME` with their TS modules in T307. From T308 on, those modules load JSON, so only the projects comparison (against the legacy `projects/*.ts` modules) still checks the old source.
- T312 and T313 are not done yet: T312 waits for `migration.test.ts` to pass in CI on this branch, and T313 deletes the modules that test imports.
