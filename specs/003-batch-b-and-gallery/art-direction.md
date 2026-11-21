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

T233: Owner requested a PR for deploy review. Add a separate compiled review entry
only to Netlify's deploy-preview build command. Keep public/admin manifests intact
and the production homepage unchanged; mark the review page noindex.

## Production homepage correction — owner request 2026-11-20

The owner approved the Swiss overview and requested it live. PR #33 shipped shared artwork
but left the overview behind a review-only entry. This correction promotes that approved
composition to `/` in the normal production build.

- FR-235: `/` shows the approved hero, selected work, capabilities and career sections using
  published production content. `/experience` preserves the complete career timeline.
- FR-236: Overview, Experience and Projects navigation, project dialogs, résumé, browser
  Back/Forward, keyboard focus and admin base routes continue working. Section links reach
  their category or era. No review-only build step is required for the homepage.
- FR-237: Static metadata, sitemap and no-JavaScript pages reflect these routes.

Plan: reuse the approved renderer as a production component; connect it to the existing
router and dialog orchestration; add homepage and routing regression coverage; verify the
production build and deploy, then inspect the actual live root.

- T234: Promote the approved overview and integrate production routes (FR-235–237).
- T235: Test, independently review, merge and verify the live homepage (FR-235–237).

T234–T235 verification: `npm run check` (708 tests), `npm run build`, `npm run budgets`
(all hard limits pass; initial JS 23.1 KB / 25 KB), and all 105 browser tests passed.
Browser coverage includes the production root at 390/1280 px, axe, duplicate project focus,
Back/Forward, batched category/era links and video playback at 1920 px. Independent review
identified a hidden-wall media observer issue; it was corrected and regression tested.
Admin retains its original two-view shell and `/admin` timeline; public navigation now has
Overview, Experience and Projects. No locked screenshot baselines were changed.
