# Spec 001: Career Timeline Wall

| Field | Value |
| --- | --- |
| Status | **Approved (CP0, 2026-10-23)**: defaults accepted, with the owner clarifications in §11 |
| Owner | Eric Thayer |
| Amended by | [002 hero and résumé](../002-hero-and-resume/spec.md) §5 (FR-007, FR-008, FR-070, résumé links) |
| Companions | [research.md](./research.md) · [data-model.md](./data-model.md) · [plan.md](./plan.md) · [tasks.md](./tasks.md) · [constitution](../constitution.md) |

## 1. Summary

A single-page, full-bleed wall of bento-grid cards. Each card is one project or chapter from Eric Thayer's career, 2003 to now, in reverse-chronological order. Cards come in two treatments:

- **Standard** (about 75 % of cards): media-forward tiles like the reference gallery. The media fills the tile and a solid label chip carries the title, client, and year. The media is a **screenshot**, a **short muted video loop**, a **non-interactive live iframe**, or a designed **placeholder** when no asset exists yet.
- **Swiss** (about 25 %, spread evenly through the timeline): International Style posters with a header label, index numerals, a display title, an art zone, and a track-list footer. The art zone shows **generative Swiss artwork** or any of the media above. Clicking a card opens a **full-screen dialog** with the project details. Below 1800 px the wall scrolls vertically. **Above 1800 px it scrolls horizontally.** Cards render in batches as the visitor scrolls ("infinite" scrolling) until the timeline reaches its end cap.

## 2. Goals and non-goals

**Goals**
- G1. Present 15+ years of design and front-end work as a browsable artifact that itself shows design-systems skill.
- G2. Give each project a distinct, consistent visual identity, even ones without shareable screenshots (NDA work).
- G3. Meet the constitution's a11y and performance bars at launch.
- G4. Adding a project means editing one typed file and dropping media in a folder.

**Non-goals (v1)**
- CMS or backend; analytics beyond Netlify's server-side stats; search or filtering; i18n.
- A looping, truly endless wall. The timeline has a real beginning and end (see ADR-3 in plan).
- Replacing ethayer.design. This ships as a standalone site (Q4).

## 3. User stories and acceptance

Priorities: **P1** = MVP, **P2** = launch, **P3** = post-launch.

### US1 (P1). Scan the career at a glance
A hiring manager lands on the page and reads the wall as a mosaic of posters, newest work first.
- **Given** a viewport ≤ 1800 px wide, **when** the page loads, **then** cards fill the width in square-cell columns and the page scrolls vertically.
- **Given** a viewport > 1800 px wide, **when** the page loads, **then** cards fill the available height in 2–4 rows and the wall scrolls horizontally. A vertical mouse wheel moves the wall horizontally.
- **Given** any viewport, **then** era markers (for example "CoBank 23—→") start each chapter, and the first tile is an identity poster with name, role, and contact links.

### US2 (P1). Open a project
- **Given** a focused or hovered card, **when** the visitor clicks it or presses Enter, **then** a full-screen modal dialog opens with that project's details, and focus lands on the dialog title.
- **When** the visitor presses Esc, activates Close, or uses browser Back, **then** the dialog closes and focus returns to the originating card.
- **While** the dialog is open, **then** the wall is inert and doesn't scroll, and the layout doesn't shift.

### US3 (P1). See real work in the card
- **Given** a card whose media is `image`, `video`, `iframe`, `artwork`, or `placeholder`, **then** it renders that media in the art zone. Allowed combinations follow the size × media matrix (data-model §2).
- **Given** a project with no usable asset or a broken link, **then** its card shows a placeholder wireframe in the project's theme, and the broken link is left out of the dialog.
- **Given** a video or iframe card scrolled out of view, **then** it stops playing or unmounts (scheduler rules, FR-034).

### US4 (P1). Accessible and calm
- **Given** `prefers-reduced-motion: reduce`, **then** no video autoplays, no live iframes mount, and transitions are instant.
- **Given** the global "Pause motion" toggle is on, **then** the same applies regardless of OS setting, and the choice persists.
- **Given** a keyboard-only or screen-reader user, **then** every story in this section can be completed without a pointer.

### US5 (P2). Share a project
- **Given** the URL `/work/<slug>`, **when** it loads, **then** the wall renders and the dialog opens on that project. The document title reads `<Project> — Eric Thayer`.
- **Given** an unknown slug, **then** the wall renders, a polite status says "Project not found", and the URL is replaced with `/`.
- **Inside** the dialog, Previous and Next (buttons, and ← → keys) step through the timeline and update the URL without stacking history entries.

### US6 (P2). Progressive "infinite" loading
- **When** the visitor nears the end of the rendered cards, **then** the next batch renders before they reach it, and a polite live region announces "Loaded N more projects (YYYY–YYYY)".
- **When** the last batch renders, **then** an end-cap tile (education plus resume and contact) closes the timeline.

### US7 (P3). Orient in time
- An era rail shows where the viewport sits in the timeline and jumps to an era on activation.

### US8 (P2). Author content safely
- **Given** an invalid content entry (duplicate slug, missing alt text, iframe on an `sm` card, title too long for its size, failing contrast), **then** `npm test` fails with a message naming the slug and the rule.

## 4. Functional requirements

### Wall layout
- **FR-001** The wall is one ordered list (`<ol>`) of grid items in reverse-chronological order, grouped by era (data-model §5).
- **FR-002** Cells are square. Width ≤ 1800 px: column count steps by **container** width (2 / 3 / 4 / 5 / 6 at 0 / 600 / 900 / 1200 / 1500 px). Cell size is `(100cqi − gaps) / cols`, so cells stay fluid between steps.
- **FR-003** Viewport width > 1800 px (`@media (min-width: 1801px)`; a viewport query because the requirement is about screen width, and a container measurement would shift by the scrollbar gutter): the grid flows by column. Row count is 2 / 3 / 4 for viewport height < 800 / < 1100 / ≥ 1100 px. Cell size is `(wall block-size − gaps) / rows`. The wall scrolls on the x-axis, and `overscroll-behavior-x: contain` prevents back-swipe navigation.
- **FR-004** Card spans: `sm` 1×1, `wide` 2×1, `tall` 1×2, `feature` 2×2. Packing uses `dense`. The owner accepted the small visual reordering this causes (§11), so there's no displacement assertion.
- **FR-005** In horizontal mode, a vertical wheel scroll (|ΔY| > |ΔX|, no Ctrl/Meta) scrolls the wall horizontally. `deltaMode` is normalized. Native horizontal trackpad gestures are untouched.
- **FR-006** The wall gap is a token (default 4 px). The wall background is `ink`.
- **FR-007** The header is a slim bar (≤ 64 px) with name, role, Resume, Contact, and the motion toggle. In horizontal mode the wall block-size is `100dvh − header`.
- **FR-008** The first grid item is the identity poster (`feature`): name, title, a one-line summary, and links (Resume, LinkedIn, GitHub, CodePen, Email).

### Cards
- **FR-010** Each card is an `<article>` labeled by its title heading (`h3`). One link (`<a href="/work/<slug>">`) inside the heading carries the accessible name. A pseudo-element stretches its hit area to the whole card.
- **FR-011** The Swiss anatomy by size tier (plan §4) includes a header (client, 2 lines), index numerals (`yy_` / `yy`, with `→` for present), title, art zone, and footer (year plus track list). Tiers hide the parts that don't fit.
- **FR-011a** The standard anatomy is media filling the tile, plus a label chip in the bottom-left corner (`ink` on `paper`, AA) with the title and "Client · Year".
- **FR-011b** Each project sets `treatment: 'swiss' | 'standard'`. Content tests enforce a Swiss share of 20–30 % and no run of more than 7 consecutive standard project cards, so roughly one card in four on screen is Swiss.
- **FR-012** The index numerals are `aria-hidden`. A visually hidden span reads "2023 to present".
- **FR-013** Title position follows `layout` (`title-top` or `title-bottom`).
- **FR-014** Typography uses container units on the card (`container-type: size`) clamped with `rem` floors. The minimum rendered size is 12 px for meta text and 16 px for titles.
- **FR-015** Themes come from `data-theme`. Text and background pairs meet AA (tested). Swiss poster type may fall back to Level A (constitution IV.5 amendment).
- **FR-016** Hover and `:focus-visible`: a duotone image or video shifts to full color in ≤ 200 ms. Focus shows a double ring (`ink` 3 px plus `paper` 3 px) that passes 3:1 on every theme.
- **FR-017** Ctrl- or Cmd-click and middle-click open `/work/<slug>` in a new tab (native link behavior is kept).
- **FR-018** In `forced-colors` mode, cards keep visible borders, art uses system colors, and focus stays visible.

### Media
- **FR-030** `image`: `<picture>` with AVIF and WebP `srcset` (480 / 960 / 1440 / 1920 w), `sizes` derived from the size tier, explicit `width` and `height`, `loading="lazy"` except the first 4 grid items (eager, and `fetchpriority="high"` on the first only), `decoding="async"`, `object-position` from `focal`. The default `treatment` is `duotone`.
- **FR-031** `video`: `muted loop playsinline`, `preload="none"`, AVIF poster. No audio track, ≤ 8 s, ≤ 1.5 MB. It plays only while ≥ 50 % visible, motion is allowed, and the play budget has room.
- **FR-032** `iframe` (card): renders at a virtual viewport (desktop 1440×900, mobile 390×844) scaled to the art zone. The wrapper is `inert` and `aria-hidden`. The iframe has `pointer-events: none`, `tabindex="-1"`, `scrolling="no"`, a `title`, `loading="lazy"`, `sandbox="allow-scripts allow-same-origin"`, and `allow=""`. The `poster` image shows until the iframe's `load` event and whenever the scheduler denies mounting.
- **FR-033** `artwork`: `<swiss-artwork>` renders the project's motif in its theme (FR-040).
- **FR-034** The media scheduler (one per page) enforces:
  - at most **3 live iframes** and **3 playing videos**, with least-recently-visible eviction;
  - mounting only after the card has been ≥ 50 % visible for 300 ms, and unmounting once it's more than one viewport away;
  - no live iframes below a 900 px container width, with `saveData`, or while motion is paused.
- **FR-035** The allowed size × media combinations are enforced by the type system and by the content tests (data-model §2).
- **FR-036** `placeholder`: a themed wireframe SVG (`site`, `mobile`, `video`, or `design` variant), seeded by slug, `aria-hidden`. It stands in for any missing screenshot, clip, or unreachable iframe.

### Swiss artwork
- **FR-040** `<swiss-artwork motif theme seed>` renders a deterministic SVG (same inputs give the same output) with `aria-hidden="true"`, built with `createElementNS`. Each motif is capped at 400 nodes.
- **FR-041** v1 ships 9 motifs (batch A, plus `horizon-lines` promoted from batch B for the NYT UI poster). Batch B is deferred, since only about 25 % of cards are Swiss (data-model §4). Each motif supports an `outlier` (one deviating element) seeded by `seed`.
- **FR-042** Every project has a `motif` even when its card shows other media. The dialog hero and the OG image use it.

### Dialog
- **FR-050** `<project-dialog>` wraps a native `<dialog>` opened with `showModal()`. It's full-viewport (`100vw × 100dvh`) and labeled by its `h2` title.
- **FR-051** Layout (plan §6): a sticky bar (Prev, counter "03 / 28", era label, Next, Close) and a poster column in the project theme (client, index, title, role, period, engagement type, track list, links). The content column on a neutral surface holds the hero media, Context / Contribution / Outcome, metrics as display numerals, and an optional gallery. Below 900 px the columns stack.
- **FR-052** Dialog media is interactive. A live iframe scrolls and can be clicked. Video shows controls. Vimeo sits behind a click-to-load facade with `dnt=1`.
- **FR-053** Esc, Close, and browser Back all close the dialog. Focus returns to the originating card. If that card isn't rendered yet (deep link), batches render through to it first.
- **FR-054** While the dialog is open, the page doesn't scroll and nothing shifts (`html:has(dialog[open])` plus `scrollbar-gutter: stable`).
- **FR-055** ← → change projects when focus isn't inside a text field, an iframe, or media controls. Buttons have targets of at least 44×44 px.
- **FR-056** Open and close use a same-document View Transition (card art zone ↔ dialog hero) when supported and motion is allowed. Otherwise a 150 ms fade, or none.
- **FR-057** The dialog module loads with dynamic `import()`, prefetched on the first card `pointerenter` or `focusin`.

### Routing
- **FR-060** Routes: `/` (wall) and `/work/:slug` (wall plus dialog), on the History API. Opening a dialog pushes a history entry, Prev/Next replace it, and closing goes back if the app pushed the entry (otherwise it replaces with `/`).
- **FR-061** Netlify rewrites `/work/*` to `/index.html` (200). After launch, prerendered pages replace the rewrite (T070).
- **FR-062** `document.title` and the canonical link update per route.

### Loading
- **FR-070** The first batch is the identity poster plus 12 items. Later batches of 12 render when a sentinel comes within one viewport of the scroll edge. The observer root is the wall itself in horizontal mode and the viewport in vertical mode.
- **FR-071** A single `role="status"` live region in the header announces batch loads and routing errors.
- **FR-072** The end-cap tile (education, résumé, contact) renders after the final batch, and the sentinel disconnects.
- **FR-073** Home and End move focus to the first and last *rendered* card. End also renders the remaining batches.

### Motion and keyboard
- **FR-080** The header toggle "Pause motion" (`aria-pressed`) defaults to the OS reduced-motion setting and persists in `localStorage`, with a try/catch fallback.
- **FR-081** Arrow keys on a focused card: ← / → go to the previous or next item in DOM order. ↑ / ↓ go to the nearest card spatially. Native Tab order is untouched.
- **FR-082** `scroll-padding` keeps focused cards clear of the sticky header and the screen edge.
- **FR-083** A skip link goes to the wall, plus a "Skip to end of timeline" link.

### Content
- **FR-090** All content lives in `src/content/projects.ts` and is typed with `satisfies readonly Project[]`. Media lives in `public/media/<slug>/`. *(Media location superseded by [004 media-pipeline FR-338](../004-admin-editing/spec-media-pipeline.md): raw sources are committed under `media-src/<slug>/`, and `public/media/<slug>/` is generated build output.)*
- **FR-091** Validation tests: unique slugs; alt text on every image and poster; media files exist; title length (`sm` ≤ 24 chars, others ≤ 40); valid era references; `period.start ≤ period.end`; theme contrast; iframe hosts on the allowlist.
- **FR-092** The CSP `frame-src` and `media-src` are generated from content at build time.

## 5. Non-functional requirements

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-01 | Performance | Constitution §V budgets, enforced in CI |
| NFR-02 | Accessibility | WCAG 2.2 AA. axe clean. Manual VoiceOver (macOS and iOS) and NVDA + Firefox passes before launch |
| NFR-03 | Browsers | Last 2 majors of Chrome/Edge, Firefox, Safari (macOS and iOS). No-JS: the identity poster and a static project list render (T070) |
| NFR-04 | Viewports | 320 to 3840 px wide, with no 2D scroll at 320 px (SC 1.4.10). Zoom to 400 % falls back to vertical mode |
| NFR-05 | Security | CSP without `unsafe-inline`; sandboxed iframes; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy` denies camera, microphone, and geolocation |
| NFR-06 | Privacy | No cookies and no third-party requests until the visitor opens a dialog with a Vimeo facade and activates it |
| NFR-07 | Maintainability | Files ≤ 300 lines; zero runtime dependencies; every component exported from `src/index.ts` |
| NFR-08 | Design lock | Visual baselines at 390 / 1280 / 1920 px per approved checkpoint |

## 6. Edge cases

| Case | Behavior |
| --- | --- |
| A site starts blocking framing | Poster shows. The weekly frameability job opens an issue |
| An iframe's `load` never fires (slow site) | Poster stays. Unmount after 10 s |
| Deep link to a project in batch 3 | Render batches 2–3 synchronously in one rAF, then open the dialog |
| Resize across 1800 px with the dialog open | The dialog is unaffected. The wall re-flows underneath. The scroll position maps to the nearest focused or first-visible card |
| The visitor rotates a phone or tablet | Same as resize. No JS layout math beyond the iframe scale |
| `localStorage` throws (private mode) | The motion toggle works for the session only |
| 200 % text-only zoom (Safari/Firefox) | `rem` floors grow the text. Titles wrap, and overflow is clipped only inside the art zone, never in text |
| Fast flick-scroll through the wall | The 300 ms visibility dwell prevents iframe and video mount storms |
| Ultra-wide 3840×1080 | 3 rows. The wall is wider than the viewport, and horizontal scroll still works |

## 7. Success criteria

| ID | Measure | Target |
| --- | --- | --- |
| SC-1 | Lighthouse (mobile, throttled) | Perf ≥ 90, A11y 100, BP ≥ 95 |
| SC-2 | axe-core violations across the e2e suite | 0 |
| SC-3 | Time from click to dialog content visible | ≤ 150 ms (p75, mid-tier laptop) |
| SC-4 | Owner adds a project | ≤ 15 min, one file plus a media folder, CI green |
| SC-5 | Visual baselines at all checkpoints | Approved and committed |

## 8. Assumptions

- **A1** Reference grid: square cells, 2×2 features, dense packing (R1).
- **A2** Hosted on Netlify, as the portfolio is today.
- **A3** The owner supplies, or approves capturing, screenshots and clips. NDA work is shown with artwork only.
- **A4** Typeface: **Hanken Grotesk** (variable, OFL, self-hosted). It's the closest free match to the reference's grotesk. A licensed face (Neue Haas Unica, Graphik) can replace it through one token.
- **A5** Ordering is by era (employer chapter, newest first), then by curated order within the era (roughly newest first).

## 9. Resolved questions (CP0, 2026-10-23)

| # | Question | Resolution |
| --- | --- | --- |
| Q1 | Is the grid square cells with 2×2 features? | **Yes.** The owner's screenshot of the pen shows 6 square columns, 2×2 features, and dense packing |
| Q2 | Should the 2018–2021 freelance work go under the era "ethayer.design — Independent 2015—2021"? | Yes (default) |
| Q3 | CoBank and Threecolts internal work: no screenshots? | Yes. Swiss artwork or placeholders |
| Q4 | Hosting | Subdomain, separate Netlify site (default) |
| Q5 | Typeface | Hanken Grotesk (default) |
| Q6 | Health Scholars Storybook (403) | Screenshot only. Link left out (broken link rule) |
| Q7 | Duotone on screenshots by default? | Yes (default) |
| Q8 | Wall background | `ink` + 4 px gap (default) |
| Q9 | SafetyHive 2.0, MAP Course Launcher, Curiteva context | **Shown with placeholder copy and media** (overrides the "hidden" default) |

## 10. Out of scope (tracked for later specs)

Tag filtering and search, a case-study long-form page per project, a CMS, comments, analytics dashboards, and a print stylesheet.

## 11. Owner clarifications (2026-10-23)

| Clarification | Spec impact |
| --- | --- |
| Use placeholders for any missing media or broken links; v1 doesn't need to be exact | FR-036 placeholder media; broken links omitted; narratives marked as drafts |
| Swiss treatment on about 25 % of cards, built for the projects with known content; placeholders and standard cards for the rest | FR-011a, FR-011b; two treatments in §1 |
| WCAG A is acceptable for the Swiss-styled cards; aim for AA | Constitution IV.5 amendment; FR-015 |
| Use the screenshot instead of the CodePen | Q1 resolved; research R1 updated |
| Don't worry about iframe frameability, dense reordering, or the date discrepancies | R4 and R6 accepted as-is; FR-004 assertion dropped; check-frameable moved to post-launch |
| Implement after updating the spec | Checkpoints collapse into one v1 review (CP1); see tasks.md |
