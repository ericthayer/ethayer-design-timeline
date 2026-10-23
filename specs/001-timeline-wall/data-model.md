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
  readonly src: string;                 // manifest key: 'dmns/cover' → /media/dmns/cover-{w}.{avif,webp}
  readonly alt: string;                 // required, describes the screenshot
  readonly focal?: `${number}% ${number}%`;   // width, height, and widths come from media-manifest.json
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
export interface PlaceholderMedia {
  readonly kind: 'placeholder';         // themed wireframe until a real asset exists
  readonly variant: 'site' | 'mobile' | 'video' | 'design';
}

/** Allowed size × media combinations (§2). Invalid combinations fail typecheck. */
export type CardMedia<S extends Size> =
  S extends 'sm'   ? ArtworkMedia | PlaceholderMedia | ImageMedia | VideoMedia :
  S extends 'tall' ? ArtworkMedia | PlaceholderMedia | ImageMedia | VideoMedia | IframeMedia<'mobile'> :
                     ArtworkMedia | PlaceholderMedia | ImageMedia | VideoMedia | IframeMedia<'desktop'>;

export type Treatment = 'swiss' | 'standard';
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
  readonly treatment: Treatment;        // ≈25 % 'swiss', spread evenly (FR-011b)
  readonly summary: string;             // ≤ 160 chars, used for the meta description and OG
  readonly body: { readonly context: string; readonly contribution: string; readonly outcome: string };
  readonly tracklist: readonly TrackItem[];   // stack and deliverables, ≤ 8
  readonly metrics?: readonly Metric[];
  readonly links?: readonly ProjectLink[];
  readonly gallery?: readonly DialogMedia[];
  readonly draft?: boolean;             // placeholder copy pending owner review
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

| Size | Span (c×r) | artwork / placeholder | image | video | iframe | Swiss anatomy shown |
| --- | --- | --- | --- | --- | --- | --- |
| `sm` | 1×1 | ✓ | ✓ | ✓ | ✗ | header, art, title |
| `tall` | 1×2 | ✓ | ✓ | ✓ | ✓ `mobile` viewport | header, title, art (square), year + track list (≤ 6) |
| `wide` | 2×1 | ✓ | ✓ | ✓ | ✓ `desktop` | left: header, title, year · right: art (square, full-bleed) |
| `feature` | 2×2 | ✓ | ✓ | ✓ | ✓ `desktop` | full poster: header, title (display), art, year + track list (≤ 8) |

Standard cards use the same matrix. Media fills the whole tile, with a label chip (title, then "Client · Year") in the bottom-left corner.

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

Generator contract: `(ctx: { rng: () => number; outlier: boolean }) => SVGElement[]` drawn in a 100×100 `viewBox`, with colors from CSS classes (`.a1`–`.a3`, `.fg`) mapped to theme custom properties. Uses a seeded PRNG (mulberry32), ≤ 400 nodes. **Batch B is deferred** (owner: Swiss on about 25 % of cards). Its rows stay here as the backlog.

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

Ordering: eras by `start` descending, then projects in authored (curated) order within each era. The curated order keeps the Swiss cards spread evenly, which date sorting can't guarantee.

## 6. Content inventory (v1, as implemented)

Media key: 🖼 image (asset from ethayer.design or GitHub) · 🎞 video (recorded clip) · 🌐 live iframe (poster from screenshot) · ▢ placeholder (`variant`) · ✳ Swiss artwork

| # | Era | Slug | Title | Size | Treatment | Card media | Motif / theme |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cobank | `agentic-engineering-loop` | Agentic Engineering Loop | feature | **swiss** | ✳ | eclipse / ink-vermilion |
| 2 | cobank | `cobank-design-system` | Multi-Framework Design System | feature | standard | ▢ design | petals / paper-mocha |
| 3 | cobank | `figma-token-pipeline` | Figma → Token Pipeline | wide | standard | ▢ design | tone-dots / ink-cyan |
| 4 | cobank | `drift-detection` | Spec & Drift Detection | tall | **swiss** | ✳ | drift-bars / paper-graphite |
| 5 | cobank | `accessible-components` | A11y Standards | sm | standard | ▢ site | nested-squares / paper-ink |
| 6 | threecolts | `qr-landing` | QR Landing Page | wide | standard | 🌐 qrlanding.netlify.app | horizon-lines / coral |
| 7 | threecolts | `onsite-figma-template` | Figma Theme Template | sm | standard | 🖼 | petals / paper-cobalt |
| 8 | threecolts | `onsite-grid-framework` | CSS Grid Framework | tall | **swiss** | ✳ | dot-grid-mark / mustard |
| 9 | threecolts | `responsive-modernization` | 200+ Responsive Rebuilds | sm | standard | ▢ mobile | scatter / navy-coral |
| 10 | health-scholars | `hs-vue-library` | Vue Component Library | feature | standard | 🖼 | tone-dots / paper-prism |
| 11 | health-scholars | `hs-brand-systems` | Brand & UI Systems | wide | **swiss** | ✳ | petals / paper-prism |
| 12 | health-scholars | `vr-design-system` | VR Design System | tall | standard | ▢ video | nested-squares / graphite-flag |
| 13 | health-scholars | `workbench` | Workbench Platform | sm | standard | ▢ site | diagonal-lines / graphite |
| 14 | health-scholars | `design-sprints` | Design Sprints | sm | **swiss** | ✳ | nested-squares / paper-vermilion |
| 15 | health-scholars | `map-course-launcher` | MAP Course Launcher | sm | standard | ▢ design | scatter / navy-coral |
| 16 | independent | `madramps` | MadRamps | wide | standard | 🌐 madramps.com | diagonal-lines / graphite |
| 17 | independent | `nyt-ui` | NYT UI Study | sm | **swiss** | ✳ | horizon-lines / paper-ink |
| 18 | independent | `merchants` | Merchants Office Furniture | wide | standard | 🎞 scroll capture | drift-bars / paper-cobalt |
| 19 | independent | `curiteva` | Curiteva | sm | standard | 🖼 | tone-dots / plum |
| 20 | independent | `safetyhive` | SafetyHive 2.0 | wide | standard | ▢ design | scatter / indigo-vermilion |
| 21 | independent | `dmns` | Denver Museum of Nature & Science | feature | standard | 🌐 dmns.netlify.app | eclipse / navy |
| 22 | independent | `sublist` | SubList Prototype | tall | standard | 🖼 | dot-grid-mark / coral |
| 23 | independent | `kyamedia-frameworks` | Startup CSS Frameworks | wide | standard | ▢ site | drift-bars / paper-graphite |
| 24 | navigators | `navigators-platforms` | 40+ Responsive Platforms | feature | **swiss** | ✳ | scatter / indigo-vermilion |
| 25 | navigators | `kentico-framework` | Kentico UI Framework | sm | standard | ▢ site | dot-grid-mark / paper-cobalt |
| 26 | dli | `dli-mobile-learning` | Mobile Learning UI | tall | standard | ▢ mobile | nested-squares / graphite |
| 27 | dli | `dli-training-media` | 100+ Training Media | sm | standard | ▢ video | tone-dots / plum |
| 28 | post-production | `motion-reel` | Motion Demo Reel | wide | standard | ▢ video (dialog: Vimeo `143960525`) | eclipse / ink-vermilion |

Swiss: 7 of 28 (25 %). The longest run of standard cards is 6 (#18–#23). Live iframes: 3, which fits the scheduler budget. Every project keeps a `motif`, which the dialog uses when a card has no media.
