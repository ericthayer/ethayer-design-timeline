# Tasks — 001 Timeline Wall

Legend: `[P]` = can run in parallel with the other `[P]` tasks in its phase · `→` = covers requirement IDs · **CP** = owner approval gate. A CP locks its visual baselines (constitution §I), and nothing after it starts until it's approved.

Each task is done when its "done when" is true **and** `npm run check` (typecheck, lint, unit) passes.

---

## Phase 0: Spec sign-off

- [ ] **T000** Owner reviews `spec.md`, `data-model.md`, and `plan.md`, then answers Q1–Q9 or accepts the defaults.
  Done when: the spec status is "Approved" and the answers are recorded in spec §9.
- [ ] **CP0** Spec approved.

## Phase 1: Scaffold (no UI)

- [ ] **T001** Initialize the npm project with Vite (vanilla-ts template stripped down). Use TS strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`. Pin exact versions. → NFR-07
  Done when: `npm run dev` serves a blank shell and `npm run build` emits ESM.
- [ ] **T002** [P] ESLint (flat config, `typescript-eslint` strict-type-checked) + Prettier. Lint rules ban `innerHTML`/`outerHTML`/`insertAdjacentHTML` and `any`, and require explicit return types. → Constitution II, VI
- [ ] **T003** [P] Vitest (happy-dom), Playwright (Chromium, Firefox, WebKit, using the pre-installed browsers), and `@axe-core/playwright`, with one smoke test each.
- [ ] **T004** [P] `netlify.toml`: build command, `/work/* → /index.html 200`, security headers (CSP placeholder until T066), and long-cache immutable assets. → FR-061, NFR-05
- [ ] **T005** [P] `scripts/check-budgets.ts`: gzip-measures `dist/` against constitution §V and exits non-zero on breach. → NFR-01
- [ ] **T006** GitHub Actions CI pipeline (plan §10), except Lighthouse, which comes in T072.
  Done when: CI is green on a PR.

## Phase 2: Foundations

- [ ] **T010** `styles/layers.css` (`@layer reset, tokens, base, components, utilities`) and `tokens.css`: swatches, the 16 `[data-theme]` themes, the type scale, spacing, the motion tokens, the focus ring, and `--wall-gap`. → FR-006, FR-015, FR-016
- [ ] **T011** [P] Self-host Hanken Grotesk variable woff2 with a Latin subset, a metric-matched fallback (`size-adjust`, `ascent-override`), and a preload. Weights 500–700. → NFR-01 (Q5 may swap the face)
- [ ] **T012** [P] `base.css`: reset, `body` background, skip links, `.visually-hidden`, `scrollbar-gutter: stable`, and the `html:has(dialog[open])` lock. → FR-054, FR-083
- [ ] **T013** `content/types.ts`, exactly as in data-model §1, with conditional `CardMedia<S>`. Type tests use `// @ts-expect-error` for every forbidden size × media pair. → FR-035
- [ ] **T014** `content/eras.ts`, `themes.ts`, `motifs.ts`, and `projects.ts` seeded with all 28 inventory rows (data-model §6). Every card starts as `artwork`, so the wall works before any assets exist. Draft context, contribution, and outcome from the résumé, marked `// DRAFT: owner review`. → FR-090
- [ ] **T015** Content validation tests: every rule in FR-091, plus theme contrast recomputed from `tokens.css` (fails below 4.5:1). → FR-091, US8
- [ ] **T016** [P] `core/dom.ts` (typed `el()`, `cloneTemplate()`, `qs()`), `core/format.ts` (period → `23_`/`→` numerals and "2023 to present"), and `core/order.ts` (projects → `WallItem[]`), each with unit tests. → FR-001, FR-011, FR-012

## Phase 3: Swiss artwork

- [ ] **T020** `<swiss-artwork>`: observed attributes `motif theme seed outlier`, a registry, mulberry32 PRNG, `createElementNS` rendering into a `viewBox` SVG with `aria-hidden="true"`, and re-rendering only on attribute change. → FR-040
- [ ] **T021** Batch A motifs: `petals`, `eclipse`, `drift-bars`, `scatter`, `tone-dots`, `dot-grid-mark`, `diagonal-lines` (+ `chevron`), `nested-squares`. → FR-041
- [ ] **T022** [P] `dev/motifs.html` gallery covering every motif × theme × 3 seeds, plus `forced-colors` emulation.
- [ ] **T023** [P] Unit tests: the same seed produces an identical serialized SVG, every motif stays at 400 nodes or fewer, and every motif renders under every theme.
- [ ] **CP1** **Art direction.** Owner approves the motif language, the 16 themes, the typeface, and the duotone default (Q7). Lock baselines for `dev/motifs.html`.
- [ ] **T024** [P] Batch B motifs: `tri-mosaic`, `halftone-halves`, `overlap`, `pinwheels`, `impossible-hex`, `concentric-knot`, `horizon-lines`, `tri-stack`, `orbit-rings`. This can run alongside Phases 4–6. → FR-041

## Phase 4: Card and media

- [ ] **T030** Four `<template data-size>` anatomies in `index.html`. `<project-card>` clones its tier and fills it with `textContent`: `<article aria-labelledby>`, `h3 > a[href="/work/<slug>"]` with a stretched hit area, and a visually hidden period. → FR-010–FR-013, FR-017
- [ ] **T031** `project-card.css`: `container-type: size`, a 6-column poster grid, the `clamp()` type scale with `rem` floors, `title-top`/`title-bottom`, and per-tier visibility of parts. → FR-011, FR-013, FR-014
- [ ] **T032** [P] `card-media/image.ts`: `<picture>` with AVIF and WebP `srcset`, per-tier `sizes`, intrinsic dimensions, focal point, and the duotone treatment (grayscale plus multiply over the theme accent). → FR-030
- [ ] **T033** [P] `card-media/video.ts`: `muted loop playsinline preload="none"`, an AVIF poster, and play/pause driven only by the scheduler. → FR-031
- [ ] **T034** [P] `card-media/iframe.ts`: a virtual viewport (1440×900 or 390×844), `--frame-scale` from a shared ResizeObserver, an inert and `aria-hidden` wrapper, `sandbox`, `allow=""`, `title`, the poster until `load`, and a 10 s timeout. → FR-032
- [ ] **T035** `core/media-scheduler.ts` + `core/motion.ts`: dwell, budgets (3 iframes and 3 videos), LRU eviction, and the motion, saveData, container-width, and dialog gates. Unit tests use fake timers and a stubbed IntersectionObserver. → FR-034, FR-080
- [ ] **T036** Card states: hover and `:focus-visible` duotone → color in 200 ms or less, the double focus ring, `forced-colors` styles, and reduced motion. → FR-016, FR-018
- [ ] **T037** `dev/cards.html`: a matrix of 4 tiers × 4 media kinds × 2 layouts × 3 themes. Add e2e and axe tests on the matrix.
- [ ] **CP2** **Card design.** Owner approves each tier at 390 / 1280 / 1920 px. Lock baselines for `dev/cards.html`.

## Phase 5: Wall

- [ ] **T040** `<timeline-wall>` + `timeline-wall.css`: `<ol>` grid in vertical mode, stepped columns, `cqi` cells, `dense`, ink background, and the gap token. → FR-001, FR-002, FR-004, FR-006
- [ ] **T041** Horizontal mode above 1800 px: column flow, rows by viewport height, `--wall-block` = `100dvh` minus the header, `overflow-x`, `overscroll-behavior-x: contain`, and the slim header. → FR-003, FR-007
- [ ] **T042** [P] `<era-marker>` (1×1: big `yy—yy` numerals, org name, `h2`), `<identity-poster>` (feature: name, role, summary, links), and the end-cap tile (tall). → FR-008, FR-072, US1
- [ ] **T043** Batch rendering: the identity poster plus 12 items, then 12 per sentinel hit. The sentinel root switches by mode, the live region announces "Loaded N more projects (YYYY–YYYY)", and the sentinel disconnects after the end-cap. → FR-070–FR-072, US6
- [ ] **T044** [P] `core/wheel.ts`: horizontal mode only, vertical-dominant deltas only, `deltaMode` normalized, skipped under Ctrl or Meta, and detached while the dialog is open. → FR-005
- [ ] **T045** [P] `core/spatial-nav.ts`: ← → in DOM order, ↑ ↓ to the nearest card by geometry, Home and End (End renders the rest), plus `scroll-padding`. → FR-073, FR-081, FR-082
- [ ] **T046** [P] `<motion-toggle>` in the header: `aria-pressed`, defaults from the OS, and persists to `localStorage` inside try/catch. → FR-080, US4
- [ ] **T047** E2E: mode switch at 1800 vs 1801 px; wheel mapping; displacement of 2 or less at 390, 768, 1024, 1280, 1600, 1920, and 2560 px; batches and announcements; keyboard nav; reduced motion; axe.
- [ ] **CP3** **Wall.** Owner approves the wall in both modes. Lock baselines at 390 / 1280 / 1920 px.

## Phase 6: Dialog and routing

- [ ] **T050** `<project-dialog>`: native `<dialog>` with `showModal()`, full viewport, `aria-labelledby`, focus on the `h2` when it opens, and the two-column layout from plan §6, stacked below 900 px. Loaded with `import()` and prefetched on the first `pointerenter` or `focusin` on a card. → FR-050, FR-051, FR-057
- [ ] **T051** [P] Dialog hero media: an interactive iframe, video with controls, an image, and a Vimeo click-to-load facade (`dnt=1`) that falls back to artwork. → FR-052, NFR-06
- [ ] **T052** `core/router.ts`: `/` and `/work/:slug`; push on open, replace on prev/next, back-or-replace on close; `popstate`; unknown slugs; title and canonical updates. → FR-060, FR-062, US5
- [ ] **T053** Prev/Next buttons (44 px minimum), a "03 / 28" counter, ← → keys guarded against inputs, iframes, and media, and Esc. → FR-055
- [ ] **T054** View Transition between the card art and the dialog hero, with dynamic `view-transition-name` and a reduced-motion bypass. → FR-056
- [ ] **T055** Focus return: the originating card, or render-through for deep links. The scheduler pauses while the dialog is open, and the page doesn't shift. → FR-053, FR-054
- [ ] **T056** E2E: open by click and by Enter, close by Esc, Close, and Back, focus restore, deep link into batch 3, unknown slug, prev/next URL updates, and axe in the open state.
- [ ] **CP4** **Dialog.** Owner approves the dialog at 390 / 1440 px. Lock baselines.

## Phase 7: Media production

- [ ] **T060** [P] `scripts/check-frameable.ts`: checks `X-Frame-Options` and CSP `frame-ancestors` for every iframe source. Re-test CodePen embeds in a real browser (R4). Add a weekly CI job that opens an issue when a host starts blocking framing.
- [ ] **T061** [P] `scripts/capture-screens.ts`: Playwright captures 1440×900 and 390×844 screenshots of live URLs into `media/<slug>/`, including iframe posters.
- [ ] **T062** [P] `scripts/capture-clips.ts` (Playwright `recordVideo` of a scripted scroll) and `scripts/encode-media.ts` (ffmpeg to AV1 WebM + H.264 MP4, 8 s or shorter, no audio, 1.5 MB or smaller).
- [ ] **T063** [P] `scripts/optimize-images.ts` (sharp to AVIF and WebP at 480 / 960 / 1440 / 1920 w). Writes a manifest that supplies `width` and `height` to content.
- [ ] **T064** Owner supplies the VR capture, the motion-reel source, and the Q9 project details. Switch cards from `artwork` to their final media per data-model §6.
- [ ] **T065** Owner approves every narrative, metric, and alt text. Remove the `DRAFT` markers.
- [ ] **T066** `scripts/gen-csp.ts`: generates `public/_headers` CSP (`frame-src`, `media-src`, `img-src`) from content at build time. → FR-092, NFR-05

## Phase 8: Hardening and launch

- [ ] **T070** `scripts/prerender.ts`: puts the first batch into static `index.html` and generates a `/work/<slug>/index.html` per project (no-JS content, OG and meta tags) using the same render functions. Remove the rewrite. → FR-061, NFR-03
- [ ] **T071** [P] `scripts/og-images.ts`: renders a 1200×630 PNG per project from `<swiss-artwork>` plus its title, using Playwright.
- [ ] **T072** [P] Lighthouse CI thresholds (SC-1). Final cross-browser e2e run and visual baselines.
- [ ] **T073** Manual a11y pass: VoiceOver (macOS and iOS), NVDA + Firefox, keyboard only, 400 % zoom, forced colors. Record results in `specs/001-timeline-wall/a11y-audit.md`. → NFR-02
- [ ] **T074** Netlify site, domain (Q4), and a README covering how to add a project (SC-4).
- [ ] **T075** (P3) Era rail: a scroll-driven progress indicator and jump links. → US7

---

## Traceability

| Requirement group | Tasks |
| --- | --- |
| Wall (FR-001–008) | T040–T043, T047 |
| Cards (FR-010–018) | T030, T031, T036, T037 |
| Media (FR-030–035) | T013, T032–T035 |
| Artwork (FR-040–042) | T020–T024 |
| Dialog (FR-050–057) | T050–T056 |
| Routing (FR-060–062) | T004, T052, T070 |
| Loading (FR-070–073) | T043, T045 |
| Motion and keyboard (FR-080–083) | T012, T035, T045, T046 |
| Content (FR-090–092) | T014, T015, T066 |
| NFRs | T001–T006, T011, T072–T074 |
