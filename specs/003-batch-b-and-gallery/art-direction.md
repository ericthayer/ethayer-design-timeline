# Swiss artwork art direction — 2026-11-20

Owner request: redesign the Swiss artwork and its relationship to type, using the
supplied Swiss Ritual / Swissted references and Eric's Swiss Ritual CodePen collection.
This request authorizes revisions to the existing poster compositions (CP3).

## Requirements

- FR-230: Keep complete geometric forms visible. Artwork uses a centered, contained
  square instead of cropping circles to the remaining text area.
- FR-231: Use consistent poster margins, quiet corner metadata, flush-left titles,
  and a compact footer. Feature titles must leave substantial room for the artwork.
- FR-232: Retain top/bottom title variants and all four existing card sizes. Wide
  cards use a shared header and separate type/art columns. Small cards omit footers.
- FR-233: Redraw the orbit, knot, overlap, pinwheel, triangle and drift motifs with deliberate
  repetition, bounded geometry and restrained accents. Preserve seeded variation,
  decorative semantics, theme tokens, and the 400-node budget.
- FR-234: Keep existing content, routing, keyboard behavior and motion preferences.

## Implementation and verification

T230: Refine the SVG generators and contained rendering (FR-230, FR-233).
T231: Refine poster CSS and expose motif identity for composition (FR-231, FR-232).
T232: Check type/lint/unit tests, production build, existing wall/dialog accessibility
checks, and inspect the rendered artwork at desktop and narrow widths (FR-234).

Use flat paper, precise geometric edges and the existing Hanken Grotesk. These
explicit Swiss references take precedence over rounded/glass treatments in the
general visual-design skill. Do not regenerate locked screenshot baselines.

## Review result

T230–T232 complete. Includes a standalone, unmerged homepage review at
`docs/design-explorations/homepage/swiss-review.html`, based on the v15 mockup's
sections and copy. It imports the real poster components and SVG generators.
Reference: https://codepen.io/collection/DRGMBP (including Eric's Otis Redding pen).

Validation: production build, lint, type checks, 708 unit tests, and 29 wall,
hero and dialog browser checks pass, including axe scans. The review entry also
passes a separate strict TypeScript check. Desktop (1280px) DOM bounds show no
banner/hero text-art overlap and no horizontal overflow. Visually inspected the
390px iframe preview. Existing visual baselines were not changed.

Regenerated social-preview images and their freshness manifest after the SVG
changes. All hard asset budgets pass; the budget checker still reports its
non-blocking +2110 B initial-JS comparison against historical commit 6240560.
