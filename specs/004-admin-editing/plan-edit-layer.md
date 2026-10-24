# Plan 004 · edit-layer

| Field | Value |
| --- | --- |
| Status | **Draft (2026-10-24)** |
| Owner | Eric Thayer |
| Companions | [spec-edit-layer](./spec-edit-layer.md) · [tasks-edit-layer](./tasks-edit-layer.md) · [capability map](./capability-map.md) · [constitution](../constitution.md) |
| Starts after | CP4a (content-json), CP4b (media-pipeline, for uploads), CP4c (admin-auth), and CP4d (github-publish) |

## 1. Components

| Component | Kind | Responsibility | FR |
| --- | --- | --- | --- |
| `core/editor/draft.ts`, `ops.ts` | pure | `Draft`, the `EditOp` reducer, the pointer whitelist, undo (20), `changeCount` | 383 |
| `core/editor/media.ts` | pure | upload naming, staged keys, referenced-key walk, candidate delete paths | 392, 394 |
| `core/editor/changes.ts` | pure | `buildChanges(draft, raw, ctx)` → plan functions + media changes → `{ changes, issues }` | 393–395, 397 |
| `core/editor/issues.ts` | pure | issue → pointer (longest prefix), counts, the publish gate `go \| confirm \| blocked` | 395 |
| `core/editor/copy.ts`, `preview.ts` | pure | user copy for each result and deploy state; `asProject` guard | 382, 397, 398 |
| `admin/edit/edit-layer.ts` | DOM | `attach(session)`, finding the dialog, re-parenting the island, observer, render loop, edit mode | 380–382 |
| `admin/edit/snapshot.ts` | fetch via publish API | `readHead` + `readFile`, `RawContent` assembly, stale-bundle notice | 384 |
| `admin/edit/draft-store.ts` | IndexedDB | `drafts` and `blobs` stores, debounce, memory fallback, `savedAt` guard | 385 |
| `admin/edit/inline.ts`, `staged-preview.ts`, `edit.css` | DOM | field decoration, `beforeinput` and paste rules, inline errors, row buttons, blob previews | 386, 387, 392 |
| `admin/edit/publish-flow.ts` | DOM + publish API | gate → publish → result routing → `watchDeploy` → View live | 397, 398 |
| `<admin-toolbar>` | component | state view, controls, live regions | 396 |
| `<admin-panel>` | component | card settings, card media, tile settings, Danger | 388, 389 |
| `<admin-gallery>` | component | tile controls, Add tile form, focal mode | 390–392 |
| `<admin-confirm>`, `<admin-create>` | components | modal dialogs for warnings, Discard, conflict, Delete, and New project | 393–395, 399 |

### Data flow
```
open dialog ─▶ snapshot (readHead, readFile@sha) or IndexedDB draft ─▶ Draft
user input ─▶ apply(op) ─▶ Draft' ─┬─▶ render: asProject → dialog.show(view) → re-append island/panel → decorate → staged previews
                                   ├─▶ draft-store.save (500 ms)
                                   └─▶ buildChanges (300 ms) → issues → toolbar + aria-invalid
Publish ─▶ gate ─▶ publish({ changes, message, expectedHeadSha: base.sha }) ─▶ copy(result) ─▶ watchDeploy ─▶ badge
```

## 2. Key decisions

1. **Zero public changes** (FR-380). The dialog's public API and `timeline:intent` are enough, so the public bundle stays byte-identical. The cost is coupling to `show()` replacing children and focusing the title. That coupling is covered by e2e. EQ5 is the fallback.
2. **The panel lives inside the modal dialog** (FR-381). A second modal would make the dialog inert, and a panel outside it would be inert itself. Below 900 px the panel takes over the body view, so focus is never hidden under it.
3. **Re-render from the draft through `show()`** instead of patching the DOM. This guarantees that the preview is the shipped UI. Text typing doesn't re-render, because the editable span already shows the text. Only structural ops re-render.
4. **The base comes from GitHub at a sha, never from the bundle.** That's what makes `expectedHeadSha` honest. Using bundled copies for the other projects only affects composition warnings.
5. **IndexedDB for drafts**, because it can store `File` blobs, so a reload keeps uploads too. localStorage is used only for the edit-mode preference.
6. **The plan functions are the validator call.** One debounced pass gives both the changes and the issues, so edit-layer has no rule logic. `asProject` is a type guard only, and a test ties it to the validator.
7. **One project per publish**, which matches `commitMessage(action, slug)` (EQ4). Delete publishes immediately. Create and update are drafts.
8. **No drag and drop and no `media-src blob:`.** Both save bytes and avoid CSP changes. Move buttons and poster previews cover the need.

## 3. Order

1. Pure core (T380–T383): draft, media naming, changes builder, issues, copy, preview guard. All unit tested and no DOM.
2. Plumbing (T384–T385): snapshot and draft store, then `attach()`, re-parenting, the render loop, the chunk rule, and the 18 KB gate. The first visible result is a draft re-rendering the real dialog.
3. Surfaces (T386–T390): toolbar, inline fields, panel, gallery editor, confirm dialogs.
4. Flows (T391–T392): create and delete, then publish and deploy.
5. Proof (T393–T396): e2e with the mocked Git Data API, axe, budgets and isolation, and an owner smoke test on a deploy preview → **CP4e**.

## 4. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| `show()` focuses the title on every re-render, which is noisy and moves focus out of the panel | The layer re-renders only on structural ops and restores focus to the same control synchronously. The status region announces the change. If screen-reader testing finds it unacceptable, EQ5 (an `{ focus: false }` seam) |
| Router-driven Prev/Next replaces the dialog children and drops the island and panel | `MutationObserver` re-attach. An e2e test navigates with the panel open and asserts that focus and the island survive |
| Esc in the panel closes the whole dialog | `keydown` Escape handled in the panel with `preventDefault` + `stopPropagation`. An e2e test asserts the dialog stays open |
| A new project isn't in main's `sequence`, so the router says "not found" | The layer opens the preview itself, with Prev and Next disabled, and handles Close. A deep link reopens it from the local draft |
| Bundle and repo drift (deploy pending or failed) | The base is always `readFile@sha`, and a notice says when the bundle is behind |
| Pasted HTML or IME glitches in `contenteditable` | `plaintext-only`, a `beforeinput` filter, `textContent` reads, `compositionend` commits, and a test pastes HTML and asserts plain text in the blob body |
| A same-key replace leaves the old extension behind | Candidate deletes, which github-publish drops when the file is missing. X1 and EQ6 for the clean fix |
| Draft loss: quota, private mode, two tabs | try/catch, a memory fallback with a warning and `beforeunload`, and the `savedAt` guard against overwriting another tab |
| A deploy fails after the commit lands on `main` | Clear copy and the log link. The draft base is already the commit, so the owner fixes and publishes again. Revert is EQ7 |
| Budget creep (five components plus inline editing) | The `admin-edit` chunk is gated at 18 KB from T385 onward and measured in each PR. Shared helpers (`el`, `defineOnce`) are reused |
| A 401 in the middle of a publish | The `unauthorized` copy, admin-auth's re-auth dialog, the new session adopted on `admin:signed-in`, the draft kept, and a manual retry |

## 5. Checkpoints

- **After T385**: an existing project's draft re-renders the real dialog, survives a reload, and `npm run budgets` shows public bytes unchanged.
- **After T392**: a full edit → publish → Live cycle against the e2e mock.
- **CP4e** (after T396): the owner reviews the toolbar, panel, gallery editor, and publish copy on a deploy preview, publishes one real edit and one upload, and answers EQ1–EQ7 and the consolidated list in spec §12.
