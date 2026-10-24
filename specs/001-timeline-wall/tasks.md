# Tasks — 001 Timeline Wall

Legend: `[P]` = can run in parallel with the other `[P]` tasks in its phase · `→` = covers requirement IDs · **CP** = owner approval gate. Approving a CP locks its visual baselines (constitution §I).

Each task is done when its "done when" is true **and** `npm run check` (typecheck, lint, unit) passes.

**Gate change (owner, 2026-10-23):** after CP0 the owner asked for implementation, so the per-phase gates CP1–CP4 are folded into a single **v1 review (CP1)**. v1 is built end to end first. Design lock (visual baselines) starts when CP1 is approved.

---

## Phase 0: Spec sign-off

- [x] **T000** Owner reviews the spec and answers Q1–Q9. Done 2026-10-23 (defaults plus spec §11 clarifications).
- [x] **CP0** Spec approved.

## Phase 1: Scaffold

- [x] **T001** npm project: Vite 8, TypeScript 6.0 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`), exact pinned versions. → NFR-07
- [x] **T002** [P] ESLint (flat config, `typescript-eslint` strict-type-checked) + Prettier. Lint rules ban `innerHTML`/`outerHTML`/`insertAdjacentHTML` and `any`, and require explicit return types. → Constitution II, VI
- [x] **T003** [P] Vitest (happy-dom), Playwright 1.63 (the pre-installed Chromium locally; Chromium, Firefox, and WebKit in CI), `@axe-core/playwright`.
- [x] **T004** [P] `netlify.toml`: build, `/work/* → /index.html 200`, security headers including CSP, long-cache assets. → FR-061, NFR-05
- [x] **T005** [P] `scripts/check-budgets.ts`: gzip sizes of `dist/` against constitution §V. → NFR-01
- [x] **T006** GitHub Actions CI: typecheck, lint, unit, build, budgets, e2e (Chromium). First run happens on push.

## Phase 2: Foundations

- [x] **T010** `layers.css` + `tokens.css`: swatches, the 16 `[data-theme]` themes, type scale, spacing, motion, focus ring, wall gap. → FR-006, FR-015, FR-016
- [x] **T011** [P] Self-hosted Hanken Grotesk variable woff2 (Latin) + metric-matched fallback + preload.
- [x] **T012** [P] `base.css`: reset, skip links, `.visually-hidden`, header, scroll lock while the dialog is open. → FR-054, FR-083
- [x] **T013** `content/types.ts` per data-model §1, with type tests for forbidden size × media pairs. → FR-035
- [x] **T014** Content: eras, themes, motifs, and 28 projects per data-model §6. Draft narratives come from the résumé (`draft: true` where the copy is placeholder). → FR-090, FR-011b
- [x] **T015** Content validation tests: FR-091 rules, Swiss share of 20–30 %, standard runs of 7 or fewer, theme contrast. → FR-091, FR-011b
- [x] **T016** [P] `core/dom.ts`, `core/format.ts`, `core/order.ts` + unit tests. → FR-001, FR-011, FR-012
- [x] **T017** [P] Media: download the owner's portfolio images, `scripts/optimize-images.ts` (sharp to AVIF and WebP at 480 / 960 / 1440 w plus `media-manifest.json`), and one recorded scroll clip (`scripts/capture-clip.ts`, Playwright + ffmpeg). → FR-030, FR-031

## Phase 3: Artwork, cards, media

- [x] **T020** `<swiss-artwork>` + mulberry32 + registry + 9 motifs (batch A + `horizon-lines`) + determinism and node-cap tests. → FR-040, FR-041
- [x] **T030** `<project-card>` Swiss anatomy (4 tiers, title-top or title-bottom). → FR-010–FR-014
- [x] **T031** `<project-card>` standard anatomy (media + label chip). → FR-011a
- [x] **T032** [P] Media renderers: image (picture, srcset, duotone), video, iframe (virtual viewport, inert, poster), placeholder (themed wireframe). → FR-030–FR-033, FR-036
- [x] **T035** `core/media-scheduler.ts` + `core/motion.ts` + tests. → FR-034, FR-080
- [x] **T036** Card states: hover and focus-visible, double focus ring, forced colors, reduced motion. → FR-016, FR-018

## Phase 4: Wall

- [x] **T040** `<timeline-wall>`: vertical mode, stepped columns, `cqi` cells, `dense`. → FR-001–FR-004, FR-006
- [x] **T041** Horizontal mode above 1800 px + slim header. → FR-003, FR-007
- [x] **T042** [P] Era markers, identity poster, end-cap (render functions in `wall-tiles/`). → FR-008, FR-072
- [x] **T043** Batch rendering + live-region announcements + end-cap. → FR-070–FR-072
- [x] **T044** [P] `core/wheel.ts` (vertical wheel to horizontal scroll). → FR-005
- [x] **T045** [P] `core/spatial-nav.ts` (arrow keys, Home, End). → FR-073, FR-081, FR-082
- [x] **T046** [P] `<motion-toggle>`. → FR-080

## Phase 5: Dialog and routing

- [x] **T050** `<project-dialog>`: native `<dialog>`, two-column layout, lazy loaded with prefetch on intent. → FR-050, FR-051, FR-057
- [x] **T051** [P] Dialog hero media, including the Vimeo click-to-load facade. → FR-052, NFR-06
- [x] **T052** `core/router.ts`: `/work/:slug`, popstate, unknown slug, document title. → FR-060, FR-062
- [x] **T053** Prev/Next + keys + counter. → FR-055
- [x] **T054** View Transition card → dialog (progressive; verified manually, not covered by e2e). → FR-056
- [x] **T055** Focus return with render-through for deep links. → FR-053

## Phase 6: v1 verification

- [x] **T060** E2E (Chromium): wall renders, layout switches at 1800 vs 1801 px, wheel mapping, batches, dialog open/close/back/deep-link/prev-next, focus restore, motion toggle, axe on the wall and the open dialog.
- [x] **T061** Screenshot review at 390 / 1280 / 1920 px; fix defects; `npm run build` within budgets (initial JS 16.5 KB, CSS 6.1 KB, font 33.9 KB gzip/raw).
- [ ] **CP1** **v1 review.** Owner reviews the running build (Netlify preview or `npm run dev`). Approved designs get locked as Playwright baselines (`tests/visual/`).

## After CP1 (backlog, not in v1)

T070 and T071 were started ahead of CP1 at the owner's request (2026-10-24). They change nothing visible when JavaScript is on.

- [x] **T070** Static prerender as a Vite plugin: per-route head and social tags, `<noscript>` static content, `work/<slug>.html`, forced `_redirects`, `sitemap.xml`, `robots.txt`. Replaces first-batch rendering and hydration, which is dropped (spec §11). → FR-061, FR-062, FR-130–FR-135, NFR-03, US13
- [x] **T071** OG poster images: `tools/og-card`, `npm run og`, committed `public/og/*.png`, freshness manifest and tests. → FR-136
- [ ] **T072** [P] Lighthouse CI; Firefox and WebKit e2e; visual baselines.
- [ ] **T073** Manual screen reader pass (VoiceOver, NVDA). → NFR-02
- [ ] **T074** Netlify site + subdomain (Q4) + README on adding projects (SC-4).
- [ ] **T075** (P3) Era rail. → US7
- [ ] **T076** Batch B motifs. → FR-041
- [ ] **T077** Real media to replace placeholders (owner assets: VR capture, motion-reel source, NDA-cleared shots); `scripts/check-frameable.ts`; generated CSP. → FR-092
