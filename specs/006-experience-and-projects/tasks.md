# Tasks — 006 Experience and Projects views

Legend as in [001 tasks](../001-timeline-wall/tasks.md). Each task is done when `npm run check` passes. UI tasks also need `npm run budgets` and `npm run e2e`.

- [x] **T500** Spec 006, plan and tasks written from the owner's 2026-10-25 request. → §1–§7
- [x] **CP6a** (approved by the owner, 2026-11-01) Owner approves the spec, the category list (Q1) and the initial assignment (plan §3), and answers Q2–Q5.

Nothing below starts until CP6a is approved.

**Data first (no visible change; lands before 004 edit-layer T380+)**

- [x] **T501** `categories.ts` (`CATEGORY_IDS`, `CategoryId`, `CATEGORIES`), `Project.categories` type, and the plan §3 assignment in every project JSON. → FR-500, FR-501, FR-503, FR-504
- [x] **T502** Validator rule `category-ref` and tests: missing, empty, unknown, duplicate, more than two. Fixtures updated. → FR-502

**Projects view**

- [x] **T503** `buildCategoryItems()` in `core/order.ts`, plus unit tests (one card per project, section order, Experience order within a section, counts). → FR-510, FR-503
- [x] **T504** `renderCategory()` marker tile, `timeline-wall` `replaceItems()` and per-view `label`, accessible names. → FR-511–FR-513, plan §4
- [x] **T505** Router: `/projects` route, history state `{ view }`, dialog return-to-view, Prev/Next per view. → FR-521, FR-530, FR-531
- [x] **T506** `view-switch` component in the header, skip links per view, View Transition, focus handoff. → FR-520–FR-522
- [x] **T507** Prerender `/projects` (title, description, canonical, OG image, sitemap, `_redirects`). → FR-523, FR-514
- [x] **T508** Dialog "Focus" fact with the category labels. → FR-532

**Footer**

- [x] **T509** `site-footer` component, portrait through the media pipeline, draft copy, placeholder portrait at 1440 × 1800, on both views. → FR-540–FR-542
- [x] **T510** Revert the T078 prototype commits on the PR #13 branch, so the Experience end-cap is unchanged (FR-543). PR #13 carries spec 006 instead.

**Admin**

- [ ] **T511** Categories fieldset in the edit-layer form. It lands with T38x (edit-layer hasn't started), since there is no form to add it to yet. → FR-550

**Verify**

- [x] **T512** e2e over `/` and `/projects`: switch, deep link, return-to-view, keyboard, axe; budgets. → §4
**CP6b review fixes (owner, 2026-11-01)**

- [x] **T513** Résumé dialog fits at 320 px: `minmax(0, 1fr)` column, bar title hidden below 480 px. → FR-533
- [x] **T514** Full-width category markers and in-order packing below 900 px. → FR-515
- [x] **T515** Split-screen dialog: independent pane scrolling and a resizable separator. → FR-534
- [x] **T516** Editorial gallery with figcaptions, and the optional gallery `note`. → FR-535, FR-536
- [x] **T517** Unit and e2e tests for T513–T516; budgets. → §4

- [ ] **CP6b** Owner reviews the running build (Projects grid, view switch, footer) at 390, 1280 and 1920 px. Approval locks the new visuals. Baselines need the owner's written OK.
