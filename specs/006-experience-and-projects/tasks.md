# Tasks — 006 Experience and Projects views

Legend as in [001 tasks](../001-timeline-wall/tasks.md). Each task is done when `npm run check` passes. UI tasks also need `npm run budgets` and `npm run e2e`.

- [x] **T500** Spec 006, plan and tasks written from the owner's 2026-10-25 request. → §1–§7
- [ ] **CP6a** Owner approves the spec, the category list (Q1) and the initial assignment (plan §3), and answers Q2–Q5.

Nothing below starts until CP6a is approved.

**Data first (no visible change; lands before 004 edit-layer T380+)**

- [ ] **T501** `categories.json`, `category-order.json`, `categories.ts`, `CategoryId`, `Project.categories` type, and the plan §3 assignment in every project JSON. → FR-500, FR-501, FR-503, FR-504
- [ ] **T502** Validator rules and tests: missing, empty, unknown, duplicate, more than two. Fixtures updated. → FR-502

**Projects view**

- [ ] **T503** `buildCategoryItems()` in `core/order.ts`, plus unit tests (one card per project, section order, curated then newest-first fallback, counts). → FR-510, FR-503
- [ ] **T504** `renderCategory()` marker tile, `timeline-wall` `view` property, accessible names, section row starts. → FR-511–FR-513, plan §4
- [ ] **T505** Router: `/projects` route, history state `{ view }`, dialog return-to-view, Prev/Next per view. → FR-521, FR-530, FR-531
- [ ] **T506** `view-switch` component in the header, skip links per view, View Transition, focus handoff. → FR-520–FR-522
- [ ] **T507** Prerender `/projects` (title, description, canonical, OG image, sitemap, `_redirects`). → FR-523, FR-514
- [ ] **T508** Dialog category tags. → FR-532

**Footer**

- [ ] **T509** `site-footer` component, portrait through the media pipeline, draft copy, on both views. → FR-540–FR-542
- [ ] **T510** Close PR #13 and remove its T078 changes from the branch history it shares, so the Experience end-cap is unchanged (FR-543).

**Admin**

- [ ] **T511** Categories fieldset in the edit-layer form. It lands with or after T38x, depending on which ships first. → FR-550

**Verify**

- [ ] **T512** e2e over `/` and `/projects`: switch, deep link, return-to-view, keyboard, axe; budgets. → §4
- [ ] **CP6b** Owner reviews the running build (Projects grid, view switch, footer) at 390, 1280 and 1920 px. Approval locks the new visuals. Baselines need the owner's written OK.
