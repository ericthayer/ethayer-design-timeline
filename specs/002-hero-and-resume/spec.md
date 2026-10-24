# Spec 002: Full-viewport hero and HTML résumé

| Field | Value |
| --- | --- |
| Status | **Draft (2026-10-24)**: from the owner's request after the v1 build. Awaiting CP2 review |
| Owner | Eric Thayer |
| Amends | [001 spec](../001-timeline-wall/spec.md) FR-007, FR-008, FR-070 (see §5) |
| Companions | [tasks.md](./tasks.md) · [constitution](../constitution.md) |

## 1. Summary

Three changes to the v1 wall, requested by the owner on 2026-10-24:

1. The identity poster leaves the grid and becomes a **full-viewport hero** above the wall, with a call to action that moves the visitor (and keyboard focus) to the timeline.
2. The hero gets a richer poster treatment and palette, modeled on the owner's reference (a Swiss record-sleeve poster: deep plum ground, a cascade of overlapping translucent triangles running from wine through rust to amber, white grotesk display type, index numerals, and a track-list footer).
3. The résumé stops linking out to a Google Doc. It becomes an **HTML résumé** opened in a full-screen dialog at `/resume`, with an optional **introduction video** at the top.

## 2. User stories

### US9 (P1). Land on a hero, then find the timeline
- **Given** any viewport, **when** the page loads, **then** the header plus the hero fill exactly one viewport (`100dvh`), and the timeline starts below the fold.
- **Given** the hero is visible, **then** a call to action ("Explore the timeline") tells the visitor the timeline is below.
- **When** the visitor activates the CTA (pointer, Enter, or Space on the link), **then** the page scrolls to the timeline (smoothly only when motion is allowed) and focus moves to the timeline region, so the next Tab reaches the first card.

### US10 (P1). Read a résumé without leaving the site
- **When** the visitor activates any Résumé link (header, hero, end-cap), **then** a full-screen dialog opens with the HTML résumé and the URL becomes `/resume`.
- **Given** the URL `/resume`, **when** it loads, **then** the wall renders and the résumé dialog opens.
- **When** the visitor presses Esc, activates Close, or uses Back, **then** the dialog closes and focus returns to the link that opened it (or the hero heading after a deep link).
- **Given** the owner has added an intro video, **then** it sits at the top of the résumé with native controls, captions, and a poster. It never autoplays.
- **Given** no intro video yet, **then** the same slot shows the hero artwork, so the layout doesn't change when the video arrives.

## 3. Functional requirements

### Hero
- **FR-100** `renderHero()` returns a `<section class="site-hero">` labeled by the page `h1` (name). It's the first child of `<main>`, before `<timeline-wall>`, and is not a grid item.
- **FR-101** Block size is `calc(100dvh - var(--header-h))`, with a `min-block-size` floor so content never clips at short heights or 400 % zoom (it grows instead).
- **FR-102** Anatomy (Swiss poster): role and location top left, index numerals `03_` / `→` top right (`aria-hidden`, plus visually hidden "2003 to present"), an eyebrow pill, the display name, generative triangle-cascade art, the span "2003—Now", and a four-column footer (summary, now, profiles, CTA). Below 720 px the footer stacks.
- **FR-103** The CTA is `<a href="#wall">`. Without JS it is a plain in-page link. With JS it scrolls the wall into view (`behavior: 'smooth'` only when motion is allowed) and focuses `<timeline-wall>` (`role="region"`, `aria-label="Career timeline"`, `tabindex="-1"`) with `preventScroll`.
- **FR-104** The art is a deterministic inline SVG of nested, overlapping triangles (≤ 80 nodes), `aria-hidden`. Colors come from the `plum-ember` theme tokens.
- **FR-105** Entry motion: header, title, art, and footer fade and rise in with a staggered delay, and the triangles cascade in. Transform and opacity only, custom easing, total ≤ 1.2 s. Durations collapse to 0.01 ms under reduced motion or the motion pause.
- **FR-106** Text on the hero meets AA: `paper` on `plum-deep`, and the display name stays on the plum field or a triangle color that passes 3:1 for large text (tested).

### Palette
- **FR-110** New swatches `plum-deep`, `wine`, `rust`, `ember`, `amber`, and a `plum-ember` theme in `tokens.css` and `THEMES`, covered by the contrast test. The résumé dialog uses the same theme for its masthead.

### Résumé
- **FR-120** Content lives in `src/content/resume.ts`, typed with `satisfies Resume`: headline, summary, experience (role, company, location, period, summary, highlights), skills, proficiencies, education, selected projects, and an optional `intro`. No references or phone numbers on the public site.
- **FR-121** `intro` is `{ src, poster, captions, title }`. `captions` is required by the type (WCAG 1.2.2). The video uses `controls`, `preload="none"`, `playsinline`, a WebM and MP4 source, and a `<track kind="captions" default>`.
- **FR-122** `<resume-dialog>` wraps a native full-screen `<dialog>` labeled by its `h2`. It loads with dynamic `import()`, prefetched on the first pointer or focus intent on a Résumé link.
- **FR-123** Layout: a slim bar (title, Print, Close), a plum masthead (name, headline, contact links, intro video slot), then a two-column body (experience; sidebar with skills, proficiencies, education, projects). Single column below 900 px.
- **FR-124** Routing: `/resume` is a route. Opening pushes an entry, closing goes back if the app pushed it (otherwise replaces `/`), matching FR-060. Netlify rewrites `/resume` to `/index.html`.
- **FR-125** Print: "Print / Save PDF" calls `window.print()`. Print styles show only the résumé, on white, without the video slot or the bar.
- **FR-126** While the résumé is open the wall is inert and the media scheduler's dialog gate is on (as FR-034, FR-054).

## 4. Non-functional

Constitution budgets still apply. The hero adds to the initial chunk (target ≤ 3 KB gzip JS, ≤ 2 KB CSS). The résumé is a lazy chunk.

## 5. Changes to spec 001

| 001 requirement | Change |
| --- | --- |
| FR-007 | In horizontal mode the wall block-size is `100dvh` (the header and hero scroll away above it). The page scrolls vertically to reach the wall; the wall then scrolls horizontally. A vertical wheel is remapped only while the wall's top edge sits at the viewport top, and passes through to the page when scrolling up at the wall's start |
| FR-008 | The identity poster is replaced by the hero (FR-100). It's no longer a grid item; `WallItem` drops `identity` |
| FR-070 | The first batch is 12 items (no identity poster) |
| Résumé links | Point to `/resume` (FR-124). The `<noscript>` fallback keeps the Google Doc link |
