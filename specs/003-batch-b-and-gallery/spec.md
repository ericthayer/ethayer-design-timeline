# Spec 003: Batch B Swiss artwork and bento media gallery

| Field | Value |
| --- | --- |
| Status | **Draft (2026-10-24)**: from the owner's request after the 002 merge. Awaiting the owner's review of the running build |
| Owner | Eric Thayer |
| Companions | [tasks.md](./tasks.md) · [001 spec](../001-timeline-wall/spec.md) (FR-041, FR-036) · [data-model §4 motif catalog](../001-timeline-wall/data-model.md) · [constitution](../constitution.md) |

## 1. Summary

Two additions, requested by the owner on 2026-10-24:

1. **Batch B Swiss artwork.** Eight motifs from the deferred backlog (data-model §4, rows 9–14, 16, 17) become real generators. The seven Swiss cards get more variety, and the motifs are registered for future Swiss cards.
2. **Placeholder media gallery in the project dialog.** Projects gain example media (placeholder wireframes, images, and videos) laid out as a **bento grid** with varied tile sizes. Each tile gets a focal point, so the crop or zoom lands on the interesting part of the image.

The owner's phrase "update project details" is read here as "add more project media examples". The owner's note asked for the gallery in a bento grid, and the wall is already a bento grid, so the gallery is read as the dialog's media section. If the owner meant the wall, this spec changes.

## 2. User stories

### US11 (P1). See more artwork on the wall
- **Given** the wall, **then** the seven Swiss cards each show a motif that differs from the v1 set, and no two Swiss cards share a motif.
- **Given** a motif, **then** it is deterministic for a seed, and the outlier stays distinct from the repeated pattern (FR-041).

### US12 (P1). Browse a project's media as a bento grid
- **Given** a project with a `gallery`, **when** its dialog opens, **then** the gallery appears below the metrics as a bento grid of tiles. Tile sizes are `sm`, `wide`, `tall`, and `feature`.
- **Given** a tile, **then** it has a visible caption. Placeholder tiles are decorative, so the caption is their only text. Images have alt text.
- **Given** a tile with a `focal` point, **then** the image crop or placeholder zoom centers on it.
- **Given** a narrow viewport, **then** the grid collapses to two columns and the `feature` tile spans the full width.

## 3. Functional requirements

### Batch B motifs
- **FR-200** Eight generators are added: `tri-mosaic`, `halftone-halves`, `overlap`, `pinwheels`, `impossible-hex`, `concentric-knot`, `tri-stack`, and `orbit-rings`. Each follows the generator contract (FR-040, FR-041): a 100×100 viewBox, theme classes only, a seeded `rng`, an `outlier` option, and ≤ 400 nodes.
- **FR-201** Generators live in `motifs-batch-b.ts` (≤ 300 lines, constitution III.3). `MOTIFS`, the registry, and the crop table are updated. The registry is `Record<MotifName, …>`, so the type checker enforces coverage.
- **FR-202** `overlap` uses `mix-blend-mode: multiply`, which is declared in CSS. Forced-colors mode drops the blend.
- **FR-203** Motif reassignments for the seven Swiss cards (the only place motifs are visible):

| Project | v1 motif | v2 motif | Why |
| --- | --- | --- | --- |
| `agentic-engineering-loop` | `eclipse` | `orbit-rings` | a loop and a cycle |
| `drift-detection` | `drift-bars` | `drift-bars` (kept) | drift is the subject |
| `hs-brand-systems` | `petals` | `overlap` | brand across products |
| `design-sprints` | `nested-squares` | `concentric-knot` | workshops and facilitation |
| `navigators-platforms` | `scatter` | `tri-mosaic` | composition |
| `onsite-grid-framework` | `dot-grid-mark` | `pinwheels` | interaction and prototypes |
| `nyt-ui` | `horizon-lines` | `horizon-lines` (kept) | horizons |

- **FR-204** `halftone-halves`, `impossible-hex`, and `tri-stack` are registered but not yet assigned. The owner has seven Swiss cards and each already has a motif, so these wait for a future Swiss card. This is a noted gap, not a bug.

### Bento gallery
- **FR-210** `Project.gallery` becomes `readonly GalleryItem[]`:

```ts
interface GalleryItem {
  readonly media: ImageMedia | VideoMedia | VimeoMedia | PlaceholderMedia;
  /** Visible caption and accessible name for decorative tiles. Required. */
  readonly label: string;
  readonly span?: 'sm' | 'wide' | 'tall' | 'feature'; // default 'sm'
  /** Focal point, e.g. '30% 40%'. Crops images and zooms placeholders. */
  readonly focal?: `${number}% ${number}%`;
}
```

- **FR-211** Iframe media is not allowed in the gallery. Live sites belong on the hero card.
- **FR-212** `buildGallery()` lives in `dialog-gallery.ts`, separate from `dialog-content.ts` (line budget). It renders a `<ul aria-label="Project gallery">` of `<li data-span>` tiles. Each tile holds the media and a `<p>` caption. Text goes through `textContent` (constitution II.3).
- **FR-213** The focal point is set as the custom property `--focal` with `style.setProperty` (constitution III.4). CSS uses it for `object-position` on images and `transform-origin` on placeholder zooms.
- **FR-214** Layout (CSS grid, `grid-auto-flow: dense`):
  - Desktop (≥ 900 px container): 4 columns, rows `clamp(6rem, 14vw, 11rem)`. `wide` = 2×1, `tall` = 1×2, `feature` = 2×2.
  - Below 600 px: 2 columns. `feature` and `wide` span both columns.
- **FR-215** Placeholder tiles zoom 1.35× on their focal point. Tiles clip overflow, and the zoom never reveals a blank edge.
- **FR-216** Video tiles use `preload="none"` and native controls. They never autoplay, and the motion gate and the dialog gate (FR-034) apply. Vimeo keeps its click-to-load facade (NFR-06).
- **FR-217** Gallery tiles follow focus rules (FR-016): a visible focus ring on any focusable child (video controls and the Vimeo button).

### Content
- **FR-220** Five projects get placeholder galleries with 3–5 tiles each, mixing spans and focal points: `cobank-design-system`, `figma-token-pipeline`, `hs-vue-library`, `kentico-framework`, and `dli-mobile-learning`. Every placeholder caption starts with "Placeholder ·" so no one mistakes it for a real screenshot. **Amended by [004 content-json](../004-admin-editing/spec-content-json.md) FR-318:** the "exactly these five slugs" test snapshot is dropped, because the owner now adds galleries. The caption rule stays, as the validator's `placeholder-caption` error.
- **FR-221** The one existing gallery entry (`motion-reel`, Vimeo) is migrated to the new shape and keeps its span.

## 4. Non-functional

- Constitution budgets hold: CSS ≤ 20 KB gzip (current 8.9), initial JS ≤ 25 KB (current 17.5). The gallery and motifs go in lazy or small chunks.
- Motifs are pure and unit tested: determinism, node cap, and seed variation (existing `artwork.test.ts` iterates `MOTIFS`).
- Accessibility: artwork and placeholders stay `aria-hidden`. Gallery captions and images carry the text. axe must be clean with a gallery open.

## 5. Out of scope

- Real screenshots or clips (owner assets, T077).
- A gallery on the wall cards.
- Lightbox or per-tile dialogs.
