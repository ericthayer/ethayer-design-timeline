# Data Model — 001 Timeline Wall

## 1. Types (`src/content/types.ts`, normative)

```ts
export type Size = 'sm' | 'wide' | 'tall' | 'feature';
export type Layout = 'title-top' | 'title-bottom';
export type Engagement = 'full-time' | 'contract' | 'freelance' | 'personal' | 'education';
export type YearMonth = `${number}-${'01'|'02'|'03'|'04'|'05'|'06'|'07'|'08'|'09'|'10'|'11'|'12'}`;
export type ThemeName = (typeof THEMES)[number];     // §3
export type MotifName = (typeof MOTIFS)[number];     // §4
export type EraId = (typeof ERAS)[number]['id'];     // §5

export interface ImageMedia {
  readonly kind: 'image';
  readonly src: string;                 // base path without extension: '/media/dmns/cover'
  readonly alt: string;                 // required, describes the screenshot
  readonly width: number;               // intrinsic, from the optimize-images manifest
  readonly height: number;
  readonly focal?: `${number}% ${number}%`;
  readonly treatment?: 'duotone' | 'none';   // default 'duotone' on cards
}
export interface VideoMedia {
  readonly kind: 'video';
  readonly src: string;                 // base path: emits .webm (AV1) and .mp4 (H.264)
  readonly poster: ImageMedia;
  readonly label: string;               // accessible description of the loop
  readonly durationSec: number;         // ≤ 8, checked by tests
}
export interface IframeMedia<V extends 'desktop' | 'mobile' = 'desktop' | 'mobile'> {
  readonly kind: 'iframe';
  readonly src: `https://${string}`;
  readonly title: string;
  readonly viewport: V;
  readonly poster: ImageMedia;          // shown until load, and whenever the scheduler denies mounting
}
export interface ArtworkMedia {
  readonly kind: 'artwork';             // renders the project's motif and theme
}

/** Allowed size × media combinations (§2). Invalid combinations fail typecheck. */
export type CardMedia<S extends Size> =
  S extends 'sm'   ? ArtworkMedia | ImageMedia | VideoMedia :
  S extends 'tall' ? ArtworkMedia | ImageMedia | VideoMedia | IframeMedia<'mobile'> :
                     ArtworkMedia | ImageMedia | VideoMedia | IframeMedia<'desktop'>;

export type DialogMedia = ImageMedia | VideoMedia | IframeMedia | VimeoMedia;
export interface VimeoMedia { readonly kind: 'vimeo'; readonly id: string; readonly title: string; readonly poster: ImageMedia }

export interface TrackItem { readonly label: string; readonly value?: string }   // footer and dialog track list
export interface Metric { readonly value: string; readonly label: string; readonly baseline?: string; readonly result?: string }
export interface ProjectLink { readonly label: string; readonly href: `https://${string}`; readonly kind: 'live' | 'repo' | 'figma' | 'codepen' | 'storybook' | 'prototype' | 'video' }

interface ProjectBase {
  readonly slug: string;                // kebab-case, unique, used in /work/<slug>
  readonly title: string;               // sm ≤ 24 chars, others ≤ 40
  readonly client: string;              // header label (2 lines max)
  readonly era: EraId;
  readonly engagement: Engagement;
  readonly role: string;
  readonly period: { readonly start: YearMonth; readonly end: YearMonth | 'present' };
  readonly theme: ThemeName;
  readonly motif: MotifName;
  readonly seed?: number;               // artwork variation; defaults to a hash of the slug
  readonly layout: Layout;
  readonly summary: string;             // ≤ 160 chars, used for the meta description and OG
  readonly body: { readonly context: string; readonly contribution: string; readonly outcome: string };
  readonly tracklist: readonly TrackItem[];   // stack and deliverables, ≤ 8
  readonly metrics?: readonly Metric[];
  readonly links?: readonly ProjectLink[];
  readonly gallery?: readonly DialogMedia[];
  readonly hidden?: boolean;            // drafts that are excluded from render (Q9)
}

/** Distributive discriminated union on `size`. */
export type Project = { [S in Size]: ProjectBase & { readonly size: S; readonly media: CardMedia<S> } }[Size];

/** Derived (not authored): the render list consumed by <timeline-wall>. */
export type WallItem =
  | { readonly type: 'identity' }
  | { readonly type: 'era'; readonly era: Era }
  | { readonly type: 'project'; readonly project: Project; readonly index: number; readonly total: number }
  | { readonly type: 'end-cap' };
```

## 2. Size × media matrix

| Size | Span (c×r) | artwork | image | video | iframe | Anatomy shown |
| --- | --- | --- | --- | --- | --- | --- |
| `sm` | 1×1 | ✓ | ✓ | ✓ | ✗ | header, art, title |
| `tall` | 1×2 | ✓ | ✓ | ✓ | ✓ `mobile` viewport | header, title, art (square), year + track list (≤ 6) |
| `wide` | 2×1 | ✓ | ✓ | ✓ | ✓ `desktop` | left: header, title, year · right: art (square, full-bleed) |
| `feature` | 2×2 | ✓ | ✓ | ✓ | ✓ `desktop` | full poster: header, title (display), art, year + track list (≤ 8) |

Why: below about 300 px, an iframe or screenshot can't be read and costs the most per pixel, so `sm` gets the poster. A `tall` card at 1×2 is a phone's aspect ratio, so it's the only place a mobile-viewport iframe makes sense.

## 3. Palette and themes (`src/styles/tokens.css`)

### Swatches

| Token | Hex | | Token | Hex |
| --- | --- | --- | --- | --- |
| `paper` | #F2EFE9 | | `cyan` | #2EA8E0 |
| `ink` | #121212 | | `cobalt` | #1E63AE |
| `graphite` | #3A3A3C | | `navy` | #1B2431 |
| `mocha` | #9C8172 | | `emerald` | #1E8F5A |
| `coral` | #EF6A5A | | `plum` | #5E1A36 |
| `vermilion` | #E2432F | | `blush` | #F3B6BF |
| `vermilion-deep` | #B8301F | | `indigo` | #1C1A3B |
| `mustard` | #F6AE2D | | `lemon` | #F7D83B |

### Themes: text contrast measured (WCAG relative luminance)

| Theme | bg | text | art colors | Text contrast |
| --- | --- | --- | --- | --- |
| `paper-mocha` | paper | ink | mocha | 16.32 |
| `ink-vermilion` | ink | paper | vermilion, paper | 16.32 |
| `paper-graphite` | paper | graphite | graphite, mustard, cobalt, coral | 9.89 |
| `coral` | coral | **ink** (ref: white, 3.05 ✗) | paper | 6.14 |
| `paper-prism` | paper | ink | lemon, cyan, blush, emerald | 16.32 |
| `ink-cyan` | ink | paper | cyan → navy ramp | 16.32 |
| `mustard` | mustard | **ink** (ref: white, 1.91 ✗) | paper, ink | 9.82 |
| `graphite` | graphite | paper | mocha, paper | 9.89 |
| `paper-cobalt` | paper | ink | cobalt | 16.32 |
| `navy` | navy | paper | paper | 13.62 |
| `navy-coral` | navy | paper | coral, graphite, paper | 13.62 |
| `graphite-flag` | graphite | paper | coral, cobalt, paper | 9.89 |
| `paper-vermilion` | paper | ink (title `vermilion-deep` 5.26) | coral | 16.32 |
| `plum` | plum | paper | mustard → vermilion ramp | 10.91 |
| `paper-ink` | paper | ink | ink | 16.32 |
| `indigo-vermilion` | indigo | paper | vermilion | 14.52 |

Artwork is decorative (`aria-hidden`), so art colors carry no contrast requirement. The contrast test (T015) recomputes this table from `tokens.css`.

## 4. Motif catalog (original generators, Swiss vocabulary)

| # | Motif | Construction | Outlier | Reads as | Batch |
| --- | --- | --- | --- | --- | --- |
| 1 | `petals` | Lattice of quarter-circle lens pairs | one petal rotated 90° | modular system | A |
| 2 | `eclipse` | Two offset ellipses, one filled, one stroked | offset amount | loop or cycle | A |
| 3 | `drift-bars` | Rows of bars on a strict grid | one bar rotated off-grid in an accent color | drift, QA | A |
| 4 | `scatter` | Square lattice with rotation varying by distance from center | — | responsive realignment | A |
| 5 | `tone-dots` | Circle grid with a stepped tonal ramp per row | — | scale or tokens | A |
| 6 | `dot-grid-mark` | Dot lattice on hairline grid | one dot in ink, larger | grid frameworks | A |
| 7 | `diagonal-lines` | Parallel diagonal stripes; `chevron` variant folds at the center | a gap in one stripe | pipelines | A |
| 8 | `nested-squares` | Squares nested at 45° alternating fill | — | focus ring, a11y | A |
| 9 | `tri-mosaic` | Triangle tessellation clipped to an octagon | — | composition | B |
| 10 | `halftone-halves` | Two half-discs: line hatch and dot halftone | — | science or duality | B |
| 11 | `overlap` | Overlapping primitives with `multiply` blend | central counter-form | brand across products | B |
| 12 | `pinwheels` | Repeated 4-blade glyphs in a staggered grid | — | interaction or prototypes | B |
| 13 | `impossible-hex` | Interlocking hexagonal bands, 3 tones | — | 3D or VR | B |
| 14 | `concentric-knot` | Concentric stroked loops | — | workshops or facilitation | B |
| 15 | `horizon-lines` | Horizontal bars tapering in thickness | — | landing pages, horizons | B |
| 16 | `tri-stack` | Stacked translucent triangles, color ramp | — | media production | B |
| 17 | `orbit-rings` | Concentric arcs with offset stroke dashes | — | motion or time | B |

Generator contract: `(ctx: { width: number; height: number; theme: ThemeColors; rng: () => number; outlier: boolean }) => SVGElement[]`, using a seeded PRNG (mulberry32), ≤ 400 nodes. Until batch B ships, those projects fall back to the closest batch-A motif.

## 5. Eras (chapter markers, ordered newest first)

| `id` | Marker label | Period | Engagement |
| --- | --- | --- | --- |
| `cobank` | CoBank | 2023-12 → present | full-time |
| `threecolts` | Threecolts / Onsite Support | 2023-06 → 2024-11 | contract |
| `health-scholars` | Health Scholars | 2017-12 → 2023-07 | full-time |
| `independent` | ethayer.design — Independent | 2015-07 → 2021 (Q2) | freelance |
| `navigators` | The Navigators | 2011-01 → 2015-07 | full-time |
| `dli` | Defense Language Institute | 2010-07 → 2013-09 | full-time |
| `post-production` | Post-production, San Diego | 2005 → 2010 (confirm) | full-time |
| `education` (end-cap) | Platt College: B.S. Media Arts '05 · A.A.S. Graphic Design '03 | 2003 → 2005 | education |

Ordering: eras by `start` descending, then projects within an era by `end` descending (present first), then by authored order.

## 6. Content inventory (seed for `projects.ts`)

Status: ✅ asset exists · 📸 capture from a live URL · 🎬 owner supplies source · 🎨 artwork only (no asset needed) · ❓ blocked on an open question

| Era | Slug | Title | Size | Card media | Motif / theme | Status |
| --- | --- | --- | --- | --- | --- | --- |
| cobank | `agentic-engineering-loop` | Agentic Engineering Loop | feature | artwork | eclipse / ink-vermilion | 🎨 metric 40 % (10 h → 6 h) |
| cobank | `cobank-design-system` | Multi-Framework Design System | feature | artwork | petals / paper-mocha | 🎨 120+ consumers |
| cobank | `figma-token-pipeline` | Figma → Token Pipeline | wide | artwork | tone-dots / ink-cyan | 🎨 |
| cobank | `drift-detection` | Spec & Drift Detection | tall | artwork | drift-bars / paper-graphite | 🎨 metric 33 % (18 → 12) |
| cobank | `accessible-components` | A11y Standards | sm | artwork | nested-squares / paper-ink | 🎨 metric 37 % (30 → 19) |
| threecolts | `qr-landing` | QR Landing Page | wide | iframe (desktop) | horizon-lines / coral | ✅ poster on GitHub · frameable |
| threecolts | `onsite-figma-template` | Figma Theme Template | sm | image | pinwheels / paper-cobalt | ✅ |
| threecolts | `onsite-grid-framework` | CSS Grid Framework | tall | artwork | dot-grid-mark / mustard | 🎨 |
| threecolts | `responsive-modernization` | 200+ Responsive Rebuilds | sm | artwork | scatter / navy-coral | 🎨 |
| health-scholars | `hs-vue-library` | Vue Component Library | feature | image | tri-mosaic / paper-prism | ✅ (Storybook 403, so no iframe) |
| health-scholars | `hs-brand-systems` | Brand & UI Systems | wide | artwork | overlap / paper-prism | 🎨 6 apps · 10 VR products |
| health-scholars | `vr-design-system` | VR Design System | tall | video | impossible-hex / graphite-flag | 🎬 Unity capture |
| health-scholars | `workbench` | Workbench Platform | sm | artwork | diagonal-lines / graphite | 🎨 needs a brief |
| health-scholars | `design-sprints` | Design Sprints | sm | artwork | concentric-knot / paper-vermilion | 🎨 |
| health-scholars | `map-course-launcher` | MAP Course Launcher | sm | image | pinwheels / navy-coral | ❓ Q9, 📸 |
| independent | `dmns` | Denver Museum of Nature & Science | feature | iframe (desktop) | halftone-halves / navy | ✅ frameable, plus pattern-library link |
| independent | `madramps` | MadRamps | wide | iframe (desktop) | diagonal-lines (chevron) / graphite | ✅ frameable |
| independent | `merchants` | Merchants Office Furniture | wide | image | drift-bars / paper-cobalt | ✅ |
| independent | `safetyhive` | SafetyHive 2.0 | wide | image | pinwheels / indigo-vermilion | ❓ Q9, 📸 Figma proto |
| independent | `sublist` | SubList Prototype | tall | image | scatter / coral | ✅ (XD blocks framing) |
| independent | `nyt-ui` | NYT UI Study | sm | image | horizon-lines / paper-ink | 📸 labeled "UI study" |
| independent | `curiteva` | Curiteva | sm | image | tri-stack / plum | ✅ ❓ Q9 description |
| independent | `kyamedia-frameworks` | Startup CSS Frameworks | wide | artwork | drift-bars / paper-graphite | 🎨 3 startups |
| navigators | `navigators-platforms` | 40+ Responsive Platforms | feature | artwork | horizon-lines / indigo-vermilion | 🎨 donation flows |
| navigators | `kentico-framework` | Kentico UI Framework | sm | artwork | dot-grid-mark / paper-cobalt | 🎨 |
| dli | `dli-mobile-learning` | Mobile Learning UI | tall | artwork | nested-squares / graphite | 🎨 |
| dli | `dli-training-media` | 100+ Training Media | sm | artwork | tri-stack / plum | 🎨 |
| post-production | `motion-reel` | Motion Demo Reel | wide | video | orbit-rings / ink-vermilion | 🎬 source for an 8 s loop; dialog uses Vimeo `143960525` |

Totals: 28 projects (5 feature, 8 wide, 5 tall, 10 sm), 7 era markers, the identity poster, and the end-cap. That's about 69 cells: roughly 23 columns in horizontal mode at 3 rows, or 17 rows in vertical mode at 4 columns. Three live-iframe cards (`qr-landing`, `dmns`, `madramps`) fit the scheduler budget of 3.
