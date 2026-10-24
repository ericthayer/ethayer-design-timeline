# Plan — 001 Timeline Wall

How the [spec](./spec.md) gets built. Every rule in the [constitution](../constitution.md) applies.

## 1. Architecture

```
index.html ── <header> (identity · motion toggle · status region)
           └─ <main> <timeline-wall> ─┬─ <ol class="wall__grid">
                                      │    ├─ <li> identity poster
                                      │    ├─ <li> <era-marker>
                                      │    ├─ <li> <project-card> ─┬─ poster anatomy (from <template data-size>)
                                      │    │                        └─ art zone: <swiss-artwork> | <picture> | <video> | <iframe>
                                      │    └─ <li> end-cap
                                      └─ sentinel (IntersectionObserver)
              <project-dialog>  ← loaded with import() on first card intent

src/core (pure TS, no DOM side effects at import)
  order.ts           projects → WallItem[] (eras, indexes, end-cap)
  format.ts          period → index numerals and a11y text
  media-scheduler.ts visibility dwell, budgets, LRU, motion/saveData gates
  router.ts          History API, /work/:slug, popstate
  wheel.ts           vertical wheel → horizontal scroll (horizontal mode only)
  spatial-nav.ts     arrow-key focus movement by geometry
  motion.ts          reduced-motion and user-toggle state (event target)
  dom.ts             typed el(), cloneTemplate(), $() helpers
```

Data flow is one-way: `projects.ts` → `order()` → `<timeline-wall>` renders batches → cards ask `MediaScheduler` for permission to mount live media → clicking a card calls `router.open(slug)` → `<project-dialog>` renders from data. Components talk through DOM `CustomEvent`s typed as a discriminated union (`TimelineEvent`).

## 2. Decisions (short ADRs)

| # | Decision | Chosen | Rejected and why |
| --- | --- | --- | --- |
| ADR-1 | UI layer | **Vanilla Custom Elements, light DOM** | React or Vue: 40 KB+ runtime for static data. Lit: fine, but adds a dependency for reactivity we don't need. Shadow DOM: `aria-labelledby` can't cross shadow roots, prerendering needs Declarative Shadow DOM, and global theme tokens get harder to apply |
| ADR-2 | Tooling | **Vite** (dev serves native ESM unbundled; prod emits ESM chunks with no loader runtime) + `tsc --noEmit` | Plain `tsc` + static server: no asset hashing or CSS pipeline, and module waterfalls in prod |
| ADR-3 | "Infinite" scroll | **Progressive batch rendering of a finite timeline with an end-cap** | Looping or wrapping wall: breaks chronology and focus order, and duplicates content for screen readers |
| ADR-4 | Packing | **CSS Grid `dense` + era markers as rhythm tiles**, displacement ≤ 2 tested | JS packer: layout JS on every resize, CLS before hydration, more code for about 30 items |
| ADR-5 | Dialog | **Native `<dialog>.showModal()`** + History API routes | Custom modal: reimplements focus trap, inert, and Esc. Hash routes: uglier share URLs and conflicts with skip links |
| ADR-6 | Artwork | **Procedural SVG generators** (deterministic, themeable, about 1 KB each) | Hand-drawn SVG per project: doesn't scale to 28+ items and drifts from the system. Raster: weight and theming. Escape hatch: `ArtworkMedia` can add `svg: '/media/x/art.svg'` later for hero pieces |
| ADR-7 | Content | **Typed TS module** (`satisfies readonly Project[]`) | JSON + runtime schema validator: a runtime dependency and weaker editor feedback |
| ADR-9 | Prerender | **A Vite plugin that post-processes `dist/`** (`closeBundle`): per-route head, static body in `<noscript>`, `work/<slug>.html`, sitemap, robots, `_redirects`. Pure page builders in `scripts/lib/` with unit tests | A separate Node script: relies on Node's TS stripping, which a Netlify build with an older Node 22 could lack. SSR of the wall plus hydration: a second render path for every card, and a risk to the design lock, for a page that already paints in 0.4 s warm / 1.0 s cold. Playwright snapshots of the live page: needs a browser in the Netlify build |
| ADR-10 | Social images | **Posters rendered locally with Playwright and committed** (`public/og/`), guarded by an input-hash manifest | Rendering during the Netlify build: no browser or fonts on the build image. A hosted OG service: a runtime dependency and a third-party request per share |
| ADR-11 | Prerendered URLs | **`work/<slug>.html` plus a forced `_redirects` rule per slug**, wildcard kept below as the unknown-slug fallback | `work/<slug>/index.html`: Netlify 301s `/work/<slug>` to `/work/<slug>/`, so every shared link takes a redirect and canonical forms disagree. Relying on extensionless `.html` lookup alone: works today (`/404` returns 200) but isn't guaranteed to win over the wildcard rewrite |
| ADR-8 | Fluid sizing | **Container query units** (`cqi`/`cqb`) for cells and card type, with `rem` floors | `vw`-based: wrong inside the horizontal scroller and ignores the container |

## 3. File structure

```
specs/                         constitution + per-feature specs (this folder)
index.html                     shell, <template>s for card tiers, header, skip links
netlify.toml                   build, headers (CSP generated), /work/* rewrite
src/
  index.ts                     barrel: export classes and define() for all elements
  main.ts                      bootstrap: define(), mount wall, router, lazy dialog
  components/
    timeline-wall/             timeline-wall.ts · timeline-wall.css
    project-card/              project-card.ts · anatomy.ts (module-level templates) · project-card.css
    card-media/                card-media.ts · image.ts · video.ts · iframe.ts · placeholder.ts · card-media.css
    swiss-artwork/             swiss-artwork.ts · motifs-grid.ts · motifs-form.ts · motif-types.ts · .css
    wall-tiles/                wall-tiles.ts (identity poster, era marker, end-cap render functions) · .css
    project-dialog/            project-dialog.ts · dialog-content.ts · project-dialog.css (lazy chunk)
    motion-toggle/             motion-toggle.ts
  core/                        order · format · rng · media-scheduler · router · transition · wheel · spatial-nav · motion · dom
  content/                     types.ts · eras.ts · themes.ts · motifs.ts · site.ts · media-manifest.json · projects/*.ts
  styles/                      layers.css · tokens.css · base.css · fonts.css · header.css
public/  fonts/ · media/<slug>/ · _headers (generated)
scripts/ optimize-images · capture-clip · check-budgets · vite-prerender (plugin) · og-images · lib/{html,pages,origin}.ts (pure builders)
tools/   og-card.html · og-card.ts · og-card.css (page Playwright screenshots for the link-preview images)
src/content/ og.ts (pure card data + input hashes) · og-manifest.json (generated)
check-frameable · gen-csp (backlog)
tests/   unit/ (vitest) · e2e/ (playwright + axe) · visual/ (baselines = design lock, after CP1)
```

## 4. Card anatomy by tier

All tiers share an inner 6-column poster grid. Padding is `6cqi`. Header text is `clamp(0.75rem, 4.2cqi, 1rem)` at weight 700. Titles are `clamp(1rem, 11cqi, 4.5rem)` at weight 700, with line-height 0.95, tracking −0.02em, and `text-wrap: balance`.

```
sm 1×1                tall 1×2              wide 2×1                        feature 2×2
┌───────────┐         ┌───────────┐         ┌───────────┬───────────┐         ┌───────────────────────┐
│Client  23_│         │Client  23_│         │Client  23_│           │         │Client             23_ │
│        → │         │        → │         │        → │   ART     │         │Name               →   │
│ ┌───────┐ │         │Title      │         │           │ (square,  │         │Display Title          │
│ │  ART  │ │         │Display    │         │Title      │ full-     │         │ ┌───────────────────┐ │
│ └───────┘ │         │┌─────────┐│         │Display    │ bleed)    │         │ │       ART         │ │
│Title      │         ││   ART   ││         │2024       │           │         │ │ (16:10 for media) │ │
└───────────┘         │└─────────┘│         └───────────┴───────────┘         │ └───────────────────┘ │
                      │2024 · · · │                                           │2024  React ··· 120+   │
                      │trk  · · · │                                           │      MCP   ··· 40 %   │
                      └───────────┘                                           └───────────────────────┘
```

`title-bottom` swaps the title and art order on `tall` and `feature`.

**Standard treatment** (all tiers): media fills the tile, and a label chip sits bottom-left.

```
┌───────────────────────┐
│                       │   media: image (duotone → color on hover/focus) · video loop ·
│     MEDIA (cover)     │          live iframe (scaled, inert) · placeholder wireframe
│                       │
│ ┌──────────────────┐  │
│ │ Title            │  │   chip: paper bg, ink text (AA on every theme)
│ │ Client · 2021    │  │
│ └──────────────────┘  │
└───────────────────────┘
```

Each card module builds its skeleton once as a module-level `<template>` (with `createElement`) and clones it per instance, filling it with `textContent`. Keeping templates inside the module, rather than in `index.html`, keeps components portable as ES module exports.

## 5. Wall layout (normative CSS sketch)

```css
@layer components {
  timeline-wall { container: wall / inline-size; display: block; background: var(--color-ink); }
  .wall__grid {
    --cols: 2; --gap: var(--wall-gap, 4px);
    --cell: calc((100cqi - (var(--cols) - 1) * var(--gap)) / var(--cols));
    display: grid; gap: var(--gap); list-style: none; margin: 0; padding: 0;
    grid-template-columns: repeat(var(--cols), var(--cell));
    grid-auto-rows: var(--cell);
    grid-auto-flow: row dense;
  }
  @container wall (width >= 600px)  { .wall__grid { --cols: 3; } }
  @container wall (width >= 900px)  { .wall__grid { --cols: 4; } }
  @container wall (width >= 1200px) { .wall__grid { --cols: 5; } }
  @container wall (width >= 1500px) { .wall__grid { --cols: 6; } }

  /* Horizontal mode: a viewport query (the requirement is screen width; see FR-003) */
  @media (min-width: 1801px) {
    .wall__grid {
      --rows: var(--wall-rows, 3);
      --cell: calc((var(--wall-block) - (var(--rows) - 1) * var(--gap)) / var(--rows));
      block-size: var(--wall-block);              /* 100dvh - header */
      grid-template: repeat(var(--rows), var(--cell)) / none;
      grid-auto-columns: var(--cell);
      grid-auto-flow: column dense;
      overflow-x: auto; overscroll-behavior-x: contain;
      scroll-padding-inline: var(--gap);
    }
  }
  [data-size="wide"]    { grid-column: span 2; }
  [data-size="tall"]    { grid-row: span 2; }
  [data-size="feature"] { grid-column: span 2; grid-row: span 2; }
}
@media (max-height: 799px)  { :root { --wall-rows: 2; } }
@media (min-height: 1100px) { :root { --wall-rows: 4; } }
```

JS only toggles behavior: `matchMedia('(width > 1800px)')` turns `wheel.ts` and the sentinel root on or off. Layout is pure CSS, so there's no layout shift while JS hydrates.

## 6. Dialog layout

```
┌─ sticky bar ───────────────────────────────────────────────────────────────┐
│ ← Prev    03 / 28 · CoBank 23—→                            Next →    ✕ Close│
├──────────────────────────┬─────────────────────────────────────────────────┤
│ POSTER COLUMN (theme)    │ CONTENT COLUMN (neutral paper / ink)            │
│ Client            23_    │ ┌─────────────────────────────────────────────┐ │
│                   →      │ │ HERO: live iframe · video+controls · image  │ │
│ Title (h2, display)      │ │       · vimeo facade · artwork (fallback)   │ │
│ Role · Period · Type     │ └─────────────────────────────────────────────┘ │
│ ── Track list ───────    │ Context · Contribution · Outcome (h3 each)      │
│ React/MUI ······ 120+    │ ┌────────┬────────┬────────┐                    │
│ MCP ············ 40 %    │ │  40 %  │  33 %  │  37 %  │ metrics (display)  │
│ Links ↗                  │ └────────┴────────┴────────┘ baseline → result │
│ <swiss-artwork> (bleed)  │ Gallery (optional)                             │
└──────────────────────────┴─────────────────────────────────────────────────┘
```

Grid split: `minmax(20rem, 5fr) 7fr`, stacked below 900 px. Initial focus goes to the `h2` (`tabindex="-1"`). On close, native `<dialog>` restores focus to the previously focused element, and `project-dialog` verifies the card exists before focusing it.

## 7. Media scheduler

```
card enters ≥50% ──300 ms dwell──▶ request(kind) ──▶ budget free? ──yes──▶ mount (iframe) / play (video)
        ▲                                │no                                      │
        │                                └──▶ evict least-recently-visible ───────┘
card > 1 viewport away ──▶ release(): unmount iframe → poster / pause video
gates (any = deny): motion paused · reduced motion · saveData · container < 900 px (iframes) · dialog open
```

The scheduler is one module-level instance driven by a single `IntersectionObserver` plus a `motion.ts` subscription. Iframe scaling uses one shared `ResizeObserver` and writes `--frame-scale` inside `requestAnimationFrame`.

## 8. Motion system

| Token | Value | Use |
| --- | --- | --- |
| `--dur-1` | 120 ms | hover color, focus |
| `--dur-2` | 200 ms | duotone → color |
| `--dur-3` | 320 ms | dialog view transition |
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` | everything |

`motion.ts` sets `html[data-motion="reduced"]`. All durations collapse to `0.01ms` under it, and the scheduler denies live media.

## 9. Testing strategy

| Layer | Tool | Covers |
| --- | --- | --- |
| Unit | Vitest (happy-dom) | `order`, `format`, scheduler budget and LRU, router parse, wheel normalization, motif determinism and node caps, content validation, theme contrast |
| E2E | Playwright (Chromium, Firefox, WebKit) | Layout mode at 1799 vs 1801 px, wheel mapping, displacement ≤ 2, batches + live region, dialog open/close/back/deep-link/prev-next, focus restore, scroll lock, reduced motion, motion toggle |
| A11y | `@axe-core/playwright` | Every e2e state; zero violations |
| Visual (design lock) | Playwright `toHaveScreenshot` | `dev/motifs.html`, `dev/cards.html`, wall at 390 / 1280 / 1920, dialog at 390 / 1440 |
| Perf | Lighthouse CI + `check-budgets.ts` | Constitution §V |
| Manual | Checklist | VoiceOver (macOS and iOS), NVDA + Firefox, keyboard-only, 400 % zoom, forced colors |

## 10. CI (GitHub Actions)

`typecheck → lint → unit → build → budgets → e2e (3 browsers, axe) → visual → lighthouse`. Netlify deploy previews run per PR. A weekly scheduled job runs `check-frameable.ts` and opens an issue when an iframe host starts blocking framing.

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Third-party sites block framing or go down | Med | Card loses its live preview | Poster fallback, weekly probe, screenshot captured at build |
| Live iframes hurt INP or LCP | Med | Budgets fail | Mount after `load` and idle, budget of 3, dwell time, none on mobile |
| `dense` reorders cards visibly | Low–Med | Focus order mismatch (SC 2.4.3) | Sizes tuned per era, e2e displacement assertion, era tiles absorb gaps |
| Container-unit type ignores text zoom | Med | SC 1.4.4 | `rem` floors in every `clamp()`, tested at 200 % |
| NDA exposure (CoBank, Threecolts) | Low | Legal | Artwork-only cards (Q3), owner review of every narrative |
| Hanken Grotesk reads as generic | Med | Weaker art direction | Typeface is one token; decided at CP1 |
| Wheel hijack frustrates trackpad users | Low | UX | Map only vertical-dominant deltas; never in vertical mode; never with Ctrl or Meta |

## 12. Effort estimate (focused engineering days, excluding owner content time)

| Phase | Days |
| --- | --- |
| 1 Scaffold | 0.5 |
| 2 Foundations + content seed | 1.5 |
| 3 Artwork batch A (+ batch B) | 1.5 (+1.5) |
| 4 Card + media + scheduler | 2.5 |
| 5 Wall + modes + loading | 2 |
| 6 Dialog + routing | 2 |
| 7 Media production tooling | 1.5 |
| 8 Hardening + launch | 2 |
| **Total** | **≈ 15** |
