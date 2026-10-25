# Spec 004 · edit-layer: edit in place, then publish

| Field | Value |
| --- | --- |
| Status | **Draft (2026-10-24)**: from the approved [capability map](./capability-map.md). Awaiting CP4e |
| Owner | Eric Thayer |
| Companions | [plan-edit-layer.md](./plan-edit-layer.md) · [tasks-edit-layer.md](./tasks-edit-layer.md) · [spec-content-json](./spec-content-json.md) (validator, `paths.ts`, `changes.ts`) · [spec-media-pipeline](./spec-media-pipeline.md) (FR-336, FR-337) · [spec-admin-auth](./spec-admin-auth.md) (`AdminSession`, island) · [spec-github-publish](./spec-github-publish.md) (`publish`, `watchDeploy`) · [003 spec](../003-batch-b-and-gallery/spec.md) (gallery) · [constitution](../constitution.md) |
| Resolves | content-json §10 Q2 (warnings need an explicit "Publish anyway", FR-395) and Q3 (delete also sends `delete-dir media-src/<slug>/`, FR-394) |

## 1. Objective

The owner, verbatim: "login under an /admin page and then browse the site but have Edit & Publish functionality in the project details view. A CMS toolbar, overlay, or edit-in-place would be the best UX. I'd like to avoid creating another app." So there is no second app: after sign-in, `/admin` is the real wall and the real project dialog. Text is edited **in place**, card settings sit in a **side panel inside the dialog**, and the dialog re-renders from the in-memory draft, so the preview *is* the shipped UI. One toolbar shows the state and holds Publish. The layer never talks to GitHub except through `github-publish`, never re-implements a content rule, and never ships to public visitors.

### User stories
- **US-E1 (P1). Fix a typo and publish.** **Given** `/admin/work/dmns` with edit mode on, **when** the owner clicks the title, types, and activates Publish, **then** one commit `content: update dmns via admin` changes only `src/content/data/projects/dmns.json`, the badge goes Queued → Building → Live, and "View live" opens `/work/dmns`.
- **US-E2 (P1). Change how a card looks.** **When** the owner opens Card settings and picks another theme, size, or motif, **then** the open dialog re-renders at once, and an invalid combination (an iframe on `sm`) shows its validator error on the control while the preview keeps the last valid version.
- **US-E3 (P1). Curate the gallery.** **When** the owner uploads an image, writes alt text and a caption, sets the span and focal point, and moves the tile to first, all by keyboard, **then** the tile previews from the local file, and Publish sends the JSON put plus one `put-binary` to `media-src/<slug>/<name>.<ext>` in the same commit.
- **US-E4 (P1). Create a project.** **When** the owner activates New project, enters a unique kebab-case slug, a title, and an era, **then** a preview opens with defaults, and Publish commits the new file and the `order.json` entry together.
- **US-E5 (P1). Delete a project.** **When** the owner activates Delete, types the slug to confirm, and confirms, **then** one commit removes the JSON, its `order.json` entry, and `media-src/<slug>/`.
- **US-E6 (P1). Never lose work.** **Given** unsaved edits, **when** the tab reloads, the token expires, or a publish fails, **then** the edits are still there, and the toolbar says why the publish didn't happen and what to do.
- **US-E7 (P2). Someone else changed the file.** **Given** a conflict result, **then** a dialog lists the paths and offers Reload from repository or Keep my draft.

## 2. Functional requirements

### Integration
- **FR-380** Loading and isolation. After the public app boots, `src/admin/entry.ts` (admin-auth) takes one dynamic `import('./edit/edit-layer.ts')` and calls `attach(session)`. **No public file changes.** The layer drives the existing `<project-dialog>` only through its API (`show(view)`, `hide()`, `isOpen`, `hero`, and its events). It gets main's dialog instance by dispatching `timeline:intent` on `#wall` and awaiting `customElements.whenDefined('project-dialog')`. A Vite `manualChunks` rule puts every edit-layer module in an `admin-edit` chunk. **Byte target: ≤ 18 KB gzip JS** (gated in `check-budgets`) and **≤ 3.5 KB gzip CSS**. The admin total stays ≤ 40 KB: auth 6, publish 5, validator and `changes.ts` 5, `media-rules` 1, edit 18, headroom 5.
- **FR-381** Mounting. The project dialog is a modal `<dialog>`, so everything outside it is inert. The island (`#admin-island`, which holds the toolbar) and the settings panel therefore move **inside** the open `dialog.pd` (admin-auth FR-354 allows this) and go back to `<body>` when it closes. The same applies to the résumé dialog, so Sign out stays reachable. `show()` replaces the dialog's children, so a `MutationObserver` on `dialog.pd` re-appends the island and panel and re-decorates fields after every router-driven `show()`. When the layer re-renders itself, it re-appends synchronously and puts focus back on the element that had it. The panel is **non-modal and inside the dialog**. A second modal would make the dialog inert, and then you couldn't edit while looking at settings.
- **FR-382** Edit mode. The toolbar's Edit toggle (`aria-pressed`, default on, remembered in `localStorage['timeline:admin-edit']` inside try/catch) shows or hides every editing affordance. With it off, the dialog still renders the draft, which makes it a clean preview. Renders always come from `asProject(working)`, a type guard over the `CardMedia<S>` size × media matrix. When the guard fails, the last valid render stays and the panel says "Preview shows the last valid version". A unit test proves the guard agrees with the validator's `size-media` rule for every size and media kind.

### Draft model (pure, `src/core/editor/`)
- **FR-383** A `Draft` (§6) holds the base snapshot (repo text per path at `base.sha`), the working project, the working `order.json`, the staged uploads (metadata only), and the action (`create` or `update`). `apply(draft, op)` is a pure reducer over an `EditOp` union: set text at a whitelisted JSON Pointer, patch settings, add, remove, or move a track row, metric, link, or gallery tile, update a tile, stage or unstage a file, and move within the era. **Undo/Redo:** the last 20 working copies, in memory only. Text edits group into one step per field focus. The toolbar buttons and Ctrl/Cmd+Z / Shift+Z work only while focus isn't in a text field, which keeps the browser's own text undo. `changeCount` = differing top-level fields (`body` counted per paragraph, a tile per index), plus 1 if the order changed, plus the staged files.
- **FR-384** Snapshot. The first time a project opens in a tab with no local draft, the layer calls `readHead` and then `readFile` at that sha for the project file and `order.json`. It never edits the bundle copy against a newer head, because that would overwrite commits silently. `RawContent` for validation = the repo `order.json`. Each listed slug comes from `readFile` if it's the edited one or not in the bundle, and from bundled `PROJECTS` otherwise. Eras, site, and résumé come from the bundled modules. If the repo text differs from the bundle (compared through `serialize`), a notice reads "The live site is behind the repository. You're editing the repository version." If the repo file fails validation, the project opens read-only with the issue list.
- **FR-385** Local persistence: **IndexedDB** (`timeline-admin`, version 1). Store `drafts` uses the key `[slug, baseSha]` and holds the `Draft` minus history. Store `blobs` uses the key `<repo path>` and holds the picked `File`. localStorage was rejected because it can't hold a 10 MB binary and is synchronous. Saves are debounced by 500 ms, and older keys for the same slug are removed. A draft is deleted on `ok` or `unchanged`, on Discard, and after a delete publish. It **survives Sign out** (EQ3). The token is never stored (admin-auth FR-349). Every call is wrapped in try/catch. If IndexedDB is unavailable, drafts live in memory, the toolbar says "Drafts won't survive a reload here", and `beforeunload` warns while there are changes. `beforeunload` also warns while a publish is in flight. A save that finds a newer `savedAt` from another tab reports a conflict in the toolbar and doesn't overwrite.

### Edit in place
- **FR-386** Inline fields: title, summary, the Context, Contribution, and Outcome paragraphs, track row label and value, metric value and label, and gallery captions. The layer wraps each text in a `<span class="ed-field" data-pointer="/title">` inside its host, so headings keep their role. The span gets `contenteditable="plaintext-only"` (feature-detected, falling back to `true`), `role="textbox"`, an `aria-label` ("Title", "Track 3 value", and so on), and `spellcheck`. Reads use `textContent` only, with NBSP turned into a space and the ends trimmed on commit. `beforeinput` blocks formatting, `insertParagraph`, and `insertLineBreak` (Enter never adds a line). It turns `insertFromPaste` and `insertFromDrop` into one plain-text node inserted through a `Range`. Commits wait for `compositionend`. The dialog already ignores arrow keys while focus is in an editable element.
- **FR-387** List rows. In edit mode, track lists and metrics get "Add track" and "Add metric" buttons after the list, and each row gets Remove and Move earlier/later buttons, all labeled with the row ("Remove track 3: Vue 3"). Metric baseline and result live in the panel, because the public UI shows them as one `baseline → result` span. Focus goes to the new row's first field, or to the next row after a remove.

### Settings panel
- **FR-388** "Card settings" (toolbar button with `aria-expanded` and `aria-controls`) opens `<aside class="ed-panel" aria-labelledby>` with an `<h2>`, a Close button, and fieldsets that use real controls. **Identity:** client and role (text). Era (select of `ERA_IDS` labels). Engagement (select). Period start and end (`type="month"`, plus a "Present" checkbox). **Card:** size (select), treatment and layout (radios), theme (select of `THEMES`), motif (select of `MOTIFS`), seed (number, empty means omit, plus a "New seed" button). **Order:** "Position 3 of 6 in CoBank" with Move earlier/later (`planReorder`). **Links:** rows of label, URL (`type="url"`), and kind, with add, remove, and move. **Metrics:** baseline and result per metric. **Notice:** a "Show the Draft copy notice" checkbox (the content `draft` flag). **Danger:** Delete project (FR-394). Every change applies through `apply`, re-renders, and returns focus to the control. Opening the panel moves focus to its heading, and Close or Esc returns focus to the toggle. Esc's `keydown` is handled and stopped, so it closes only the panel. At 900 px and wider, the dialog body narrows to make room. Below that, the panel replaces the body view, so nothing focusable is hidden under it (SC 2.4.11).
- **FR-389** Card media (a panel fieldset): kind `artwork`, `placeholder` (variant), `image` (upload, alt, focal X/Y, duotone), `video` (MP4 and WebM files, poster image and its alt, label, duration ≤ 8 s typed by the owner), or `iframe` (https URL, title, viewport, poster). Card uploads are named `cover`, `clip`, and `poster`, which keeps media-pipeline's cover crop rule (FR-324). The validator owns the size × media errors, which show on the kind control.

### Gallery editor
- **FR-390** In edit mode, each `.pd__tile` gets a control row: Move earlier, Move later, Tile settings, and Remove ("Move tile 2, Placeholder · Dashboard, earlier"). Focus stays on the moved tile's button, and the status region says "Moved to position 1 of 4". Tile settings opens the panel's tile section: span (select), focal X/Y (numbers 0–100), alt or poster alt, replace file, and for a placeholder the variant. An "Add tile" button after the grid (or in its place when there's no gallery) opens the tile form: kind image, video, Vimeo (id, title), or placeholder (variant). The caption is required, and a placeholder's caption is prefilled with "Placeholder · ". No drag and drop in v1.
- **FR-391** Focal point. "Set focal point" on a tile overlays a full-tile `<button class="ed-focal" aria-label="Focal point 30% 40%. Arrow keys move it; Enter or Esc finishes.">`. A click sets the point from the pointer, rounded to whole percent. Arrows move 1 % and Shift+Arrow 10 %, with the event stopped so the dialog doesn't change project. A crosshair and the tile crop update through `style.setProperty('--focal', …)` (003 FR-213). The panel's numeric inputs are the equivalent alternative.
- **FR-392** Uploads (media-pipeline FR-337). The accept lists come from `LIMITS`. Before staging, `createImageBitmap(file)` reads the size, and `checkSource` and github-publish's exported limits run. Errors show on the file field. The name is the file's basename in kebab case (`image` if that's empty), with `-2`, `-3`, and so on added against the known keys and the reserved card names. The path is `media-src/<slug>/<name>.<lowercase ext>`. A video key needs both `.mp4` and `.webm`. `ctx.mediaKeys` and `ctx.videoKeys` = manifest ∪ staged − keys about to be deleted. **Preview:** after each render, staged images get the object URL (the `<source>` elements are dropped), and staged videos show their poster with "Video plays after publish", because admin CSP has `img-src blob:` but no `media-src blob:` (EQ1). Object URLs are revoked on unstage, Discard, and publish. **Media changes:** a `put-binary` for each staged file still referenced. When a key in the base is no longer referenced by any project, the layer sends `delete` for each candidate path, `<key>.{jpg,jpeg,png,webp,avif}` (video: `.mp4`, `.webm`), leaving out any path being put. github-publish drops deletes of missing files (its FR-366). See X1.

### Create and delete
- **FR-393** New project (toolbar, available on the wall too) opens a modal `<dialog>` form: slug (`^[a-z0-9]+(-[a-z0-9]+)*$`, not in the bundle, the repo `order.json`, or a local create draft; checked on input), title, era (its engagement prefilled), client, role, and period start (this month, end "present"). Defaults: `size: 'sm'`, `treatment: 'standard'`, `layout: 'title-bottom'`, `media: { kind: 'placeholder', variant: 'site' }`, `theme: 'paper-ink'`, the first motif no Swiss card uses, empty story, an empty track list, and `draft: true`. Create opens the dialog preview (the layer calls `show()`, Prev and Next are disabled, and the layer handles its Close) with focus on the title field. The project goes to **index 0 of its era** (`planCreate(…, at = 0)`, see X4). The slug can change until the first publish, and after that it's immutable (content-json `slug`). Reloading `/admin/work/<new-slug>` with a create draft reopens it after the router's "not found" reset.
- **FR-394** Delete (panel, Danger) opens a modal `<dialog>`: "Delete dmns?", the list "its JSON file, its place in order.json, and every file in media-src/dmns/", any `planDelete` warnings, and a field "Type dmns to confirm". "Delete and publish" stays `aria-disabled` until the text matches. **Changes:** `planDelete` (JSON `delete` + `order.json` `put`) + `{ kind: 'delete-dir', path: 'media-src/<slug>/' }`, with `commitMessage('delete', slug)`. **Yes to delete-dir**, because media folders are per slug (media-pipeline FR-320), orphans would trigger media-pipeline MQ3 and grow the repo, and the delete stays one atomic, revertible commit. If another document references a key under `<slug>/`, the validator's `media-key` error (with those keys removed from `ctx`) blocks the delete and names the referrer. The delete publishes at once (there's nothing to preview), and on `ok` the dialog closes.

### Validation, toolbar, publish
- **FR-395** Validation. Every `apply` schedules `buildChanges` 300 ms later (and runs it at once on blur and before Publish). The plan functions validate the resulting bundle. Each issue maps to a control by `file` plus the longest matching `data-pointer` prefix. That control gets `aria-invalid="true"` and an error `<span id>` joined to its `aria-describedby`, placed after the host, or inside it when the host is an `<li>`. Issues with no control, or in another file, are listed only in the toolbar's Issues panel. Each entry there shows severity, message, and a "Go to field" button that opens the right panel section. **Errors block Publish.** **Warnings need "Publish anyway"** in a confirmation dialog that lists them, every time. That resolves content-json Q2: warnings are editorial (its FR-312), so the owner decides, but never by accident.
- **FR-396** Toolbar (`<admin-toolbar>` in `[data-admin-slot="toolbar"]`, `role="group" aria-label="Editor"`, plain Tab order and no roving focus): Edit toggle · a status line ("All changes published" / "4 unsaved changes · 2 errors · 1 warning") · Issues (`aria-expanded`) · Card settings · Undo · Redo · New project · Discard (confirm dialog) · Publish (primary) · the deploy badge with View commit and View live · "Local drafts: a, b" links that open those projects. A disabled control uses `aria-disabled` plus a reason in `aria-describedby` ("Fix 2 errors to publish"), so it stays focusable. Progress goes to one `role="status"` region (debounced 1 s for counts). Failures that need action use `role="alert"`. One project per publish (EQ4).
- **FR-397** Publish: gate (FR-395) → `buildChanges` → `publish(session, { changes, message: commitMessage(action, slug), expectedHeadSha: draft.base.sha })`, while the toolbar reads "Publishing 3 files…" and repeat clicks are ignored. Every failure keeps the draft. User copy (`src/core/editor/copy.ts`; every kind is covered by a test):

| Result | Toolbar copy and action |
| --- | --- |
| `ok` | "Published." (rebased: "…on top of newer commits.") The base becomes the commit, the local draft is cleared, and deploy watching starts (FR-398) |
| `unchanged` | "Nothing to publish: the repository already matches." The draft is cleared |
| `conflict` | Dialog: "These files changed on GitHub since you started: …paths". **Reload from repository** (drop the draft and re-snapshot) or **Keep my draft** (re-snapshot only the base, so the next Publish replaces those changes, and the copy says so). `race`: "Someone published at the same moment." plus Try again |
| `rate-limited` | "GitHub's rate limit is reached. Try again after 14:32 (in 12 min)." `Intl` formats `resetAt` |
| `forbidden` | `branch-protected`: "main is protected (it requires pull requests or blocks direct pushes). Allow your account to bypass the rule, or turn it off." `missing-permission`: "Your token can't write here. Set Contents to Read and write." |
| `unauthorized` | "Sign in again to publish." admin-auth's re-auth dialog opens, and the layer adopts the new session on `admin:signed-in`. It doesn't retry automatically |
| `too-large` · `invalid` | Names the file and the limit in MB and focuses its field · "The editor built a change GitHub refused (reason, path). Please report it." |
| `not-found` · `validation-rejected` · `network` · `unknown` | "Repository or branch not found." · "GitHub rejected the commit: {message}" · "Couldn't reach GitHub. Your draft is safe." · "Unexpected response from GitHub ({status})." |

- **FR-398** Deploy. After `ok`, the layer iterates `watchDeploy(session, commitSha, { signal })`, and the badge shows Queued, Building, Live, "Build failed · View log", or "Status unknown · Check Netlify". Each change is announced. On `live`, "View live" (`/work/<slug>` in a new tab) appears. On `failed`, the copy adds "The live site is unchanged. The commit is on main, so fix the content and publish again." A new publish or Sign out aborts the watcher.

### Accessibility and admin CSS
- **FR-399** Every control has a visible label. Confirm, warnings, conflict, Discard, Delete, and New project use native modal `<dialog>`s with a labeled `<h2>`, and focus returns to the opener when they close. The panel and Issues are non-modal disclosures, so there are no keyboard traps. Admin CSS sits in `@layer components`, uses theme tokens only, and sets runtime values with `style.setProperty`. **Signposting:** in edit mode, `.ed-field` shows a 1 px dashed `currentColor` outline at rest and 2 px on hover. On `:focus-visible`, the base double ring replaces it. Targets are ≥ 24 px (SC 2.5.8). The dialog's scroller gets `scroll-padding-block-end` equal to the toolbar's height (SC 2.4.11). Reduced motion removes panel transitions. axe reports zero violations on `/admin` with edit mode on in each of these states: dialog, panel, Issues, tile form, focal mode, every confirm dialog, and New project.

## 3. Tech stack
Vanilla TS custom elements (light DOM), native `<dialog>`, `contenteditable="plaintext-only"`, IndexedDB, `createImageBitmap`, `URL.createObjectURL`, `MutationObserver`, `AbortController`, and `Intl.DateTimeFormat` / `RelativeTimeFormat`. **No new dependencies.** Vitest with happy-dom for units, and Playwright with `@axe-core/playwright`, with GitHub mocked by route interception.

## 4. Commands
| Command | Use |
| --- | --- |
| `npm run dev`, then open `/admin` | edit locally (the GitHub mock from admin-auth's e2e helpers, or a real token) |
| `npx vitest run tests/unit/editor` | draft, changes, issues, copy, preview guard |
| `npm run check` | typecheck, lint, all units |
| `npm run build && npm run budgets` | `admin-edit` ≤ 18 KB, admin ≤ 40 KB, public lines unchanged |
| `npx playwright test tests/e2e/admin-edit.spec.ts tests/e2e/admin-create.spec.ts` | edit, publish, create, delete, axe |

## 5. Project structure
```
src/core/editor/{draft,ops,media,changes,issues,copy,preview}.ts   pure, unit tested
src/admin/edit/{edit-layer,snapshot,draft-store,inline,staged-preview,publish-flow}.ts
src/admin/edit/edit.css                                             .ed-field, signposts, errors
src/components/admin-toolbar/  admin-panel/  admin-gallery/  admin-confirm/  admin-create/
tests/unit/editor/*.test.ts · tests/e2e/{admin-edit,admin-create}.spec.ts · tests/e2e/github-git-mock.ts
```

## 6. Code style
```ts
export interface Draft {
  readonly v: 1;
  readonly slug: string;
  readonly action: 'create' | 'update';
  readonly base: { readonly sha: string; readonly files: Readonly<Record<string, string | null>> };
  readonly working: EditableProject; // Project with size and media widened; previewed via asProject()
  readonly order: ProjectOrder;
  readonly staged: readonly StagedFile[]; // { path, key, type, bytes, width, height }; Files live in IndexedDB
  readonly savedAt: number;
}
export type JobStatus =
  | { readonly kind: 'none' }
  | { readonly kind: 'publishing'; readonly files: number }
  | { readonly kind: 'deploying'; readonly commitUrl: string; readonly deploy: DeployState }
  | { readonly kind: 'conflict'; readonly reason: ConflictReason; readonly paths: readonly string[] }
  | { readonly kind: 'failed'; readonly result: Exclude<PublishResult, { kind: 'ok' | 'unchanged' }> };
export interface ToolbarState {
  readonly editing: boolean;
  readonly slug: string | null;
  readonly draft: { readonly changes: number; readonly errors: number; readonly warnings: number };
  readonly job: JobStatus;
}
```

## 7. Testing strategy
- **Unit (pure, no DOM)**: the `apply` ops and undo grouping, the pointer whitelist, and `changeCount`. `buildChanges`: a title edit gives one put, a create gives the file plus `order.json`, a delete gives delete + put + `delete-dir`, a same-key replace with a new extension gives `put-binary` + candidate deletes without the put path, and a removed tile deletes only unreferenced manifest keys. Issue-to-field mapping and the gate. Copy for every result kind. `asProject` agrees with the validator. Draft-store serialization, against an injected in-memory store.
- **E2E (mocked Git Data API)**: edit a title → Publish → assert the blob body holds the new title, the tree has `base_tree`, and the PATCH has `force: false` → mock statuses → Live → View live. An error blocks Publish (`aria-invalid` on the field). Warnings → Publish anyway. Conflict → Keep my draft. Reload restores the draft. Create (bodies for the file and `order.json`). Delete (tree entries with `sha: null`, including media). Upload via `setInputFiles` (blob preview, base64 `put-binary`). Keyboard-only tile reorder and focal point. axe on the FR-399 states.

## 8. Boundaries
- **Always**: go through `github-publish` and the content-json plan functions. Read text with `textContent`. Validate before every publish. Keep the draft on any failure. Cite FR ids in tests.
- **Ask first**: any change to public files (including a seam in `main.ts`, EQ5). A new CSP source (`media-src blob:`, EQ1). Raising the 18 KB target. Editing eras, site, or résumé (v2). Multi-project commits.
- **Never**: `innerHTML` or inserted pasted HTML. `fetch` to GitHub. Storing the token. Publishing with errors or without confirming warnings. Importing edit-layer code from public code. Updating a visual baseline without the owner's written approval.

## 9. Success criteria
1. US-E1 to US-E7 pass in e2e, and axe reports zero violations on every FR-399 state.
2. Public `dist/` JS and CSS are byte-identical to a build without edit-layer, `admin-edit` ≤ 18 KB gzip, and admin JS ≤ 40 KB.
3. The owner publishes one real text edit and one upload from a deploy preview, and both go live with no manual step.
4. No publish can contain an error-level issue. Every `PublishResult` kind has tested copy.

## 10. Cross-spec issues (reconciled 2026-10-24)
- **X1** Resolved in media-pipeline FR-328: manifest entries now carry a `source` file name (an additive field), so the editor deletes exactly the replaced file. Until the owner confirms EQ6, FR-392's candidate-extension delete stays as the fallback.
- **X2** Accepted: `scripts/csp.ts` (admin-auth FR-355) must stay free of `node:*` so the editor can import the frame-src list. T340-series tasks enforce this with a lint rule.
- **X3** Resolved in github-publish FR-375: `DeployState` is now defined with the `kind` shape this spec assumed.
- **X4** Resolved in content-json FR-309: `at` is the zero-based index within the era (0 = top; past the end appends).

## 11. Open questions (edit-layer)
- **EQ1** Add `media-src blob:` to admin CSP so staged videos preview? Default: no, poster only.
- **EQ2** Delete needs the slug typed (default) or a plain confirm?
- **EQ3** Keep local drafts after Sign out (default) or clear them?
- **EQ4** One project per publish (default) or batched commits (needs a new `commitMessage` form in github-publish)?
- **EQ5** If e2e shows the zero-touch dialog coupling (FR-380, FR-381) is brittle, allow a ≤ 0.2 KB seam in `main.ts`?
- **EQ6** X1: candidate deletes (default) or a `source` field in the manifest?
- **EQ7** A "Revert last publish" button for a failed deploy? Default: v2, link to the commit instead.

## 12. Owner decisions needed across 004
Resolved here: content-json Q2 and Q3. Already resolved by sibling specs: media-pipeline MQ6 (content-json FR-305 `videoKeys`) and MQ7 (github-publish FR-363 drops `.gif`). Still open:
1. **Token permission "Commit statuses: Read-only"** (admin-auth Q6 = github-publish Q1). Without it, the deploy badge always reads "unknown".
2. **Branch protection on `main`** (github-publish Q3). A rule that requires PRs blocks every publish.
3. **Netlify deploy reporting** (github-publish Q2, still to verify) and the site name for a fallback "Netlify deploys" link.
4. **Scratch repo** for the CP4d smoke test (github-publish Q5). **Limits** of 10 MB per file and 50 changes (github-publish Q4).
5. **Slug rename** in v1 (content-json Q1, default immutable). **Eras as validated strings** in v2 (content-json Q4).
6. **Media**: original cover exports (MQ1), a 1920 px width (MQ2), whether an unreferenced source fails, warns (default), or passes (MQ3), and a dev watch mode (MQ4).
7. **Admin-auth**: prefilled token URL (Q1), a gated admin CSS line at ≤ 5 KB (Q2; this spec proposes **yes**), a write probe via `POST git/blobs` (Q3), a `login` check (Q4), and Trusted Types (Q5).
8. **Edit-layer** EQ1–EQ7 above, including the X1 fix (EQ6).

Verifications still pending (no decision needed): admin-auth V1–V8, media-pipeline MQ5, github-publish FR-366 (`sha: null`) and FR-370 and FR-372 (error wording).
