# Spec 008: Homepage layout v15

| Field | Value |
| --- | --- |
| Status | **Draft, awaiting owner approval (CP8a)**. No site code changes until approved |
| Owner | Eric Thayer |
| Amends | [001 spec](../001-timeline-wall/spec.md) (home composition) · [006 spec](../006-experience-and-projects/spec.md) (What I do and Career groupings) |
| Companions | [constitution](../constitution.md) · [007 spec](../007-launch/spec.md) (launch, pending CP7b) |
| Source | Design review on the Artifact board, versions 1 to 15. Sources: `docs/design-explorations/homepage/` (PR #30) |

## 1. Summary

Version 15 of the homepage mockups reduces the page to four blocks: a hero, Selected work, a What I do banner with category rows, and a Career banner with a role list. The goal is that a hiring manager sees the three strongest projects and the scope of the work in one scroll, without reading every card.

This spec defines what changes on the live site, what stays locked, and what the owner must decide before any code moves.

## 2. Scope

**In scope**

- The home page composition: hero, Selected work (three cards with one stat each), What I do banner, category rows, Career banner, and role list.
- A banner pattern shared by What I do and Career: a header row with a label and an index number, the title beneath it, and the summary pinned to the foot. The art sits behind the text and bleeds off its outer edge. The art never covers text.
- Under 640 px, category rows show up to four tiles in a 2×2 grid.

**Out of scope**

- Project detail pages, the project dialog, and the navigation bar.
- Card art. The final artwork is made by hand, not generated (owner, 2026-11-21).
- Changes to the poster card component (`src/components/project-card/`). It stays as built.

## 3. Owner decisions required before code

| ID | Question | Recommended default |
| --- | --- | --- |
| DQ1 | Career panel artwork. v15 uses the striped NYT UI Study poster as a placeholder. The owner will make the final art by hand. | Keep the placeholder until the owner's art is ready. Ship with the stripes only if the owner accepts them. |
| DQ2 | Copy. v15 changes three headers: "Capabilities" replaces "What I do" as the eyebrow, "2010–Now" replaces "Career", and the summary sentence "23 years in UI. Systems used by 120+ designers and developers. Six roles, from multimedia specialist to systems lead." is added to the hero. | Owner approves each string. None ships unapproved. |
| DQ3 | Visual lock. CP1, CP3, and CP6b locked the current home design. This spec changes the composition, so it needs a new checkpoint. | Owner approves CP8a for the layout. Baseline updates in `tests/visual/**` need written approval on the PR (constitution I.2). |
| DQ4 | Art bleed. In v15 the art runs 35% larger than v13 and crosses the top and bottom edges of the banner. | Owner confirms that crossing top and bottom is acceptable. The alternative is taller banners. |

## 4. Acceptance

- **AC1.** No artwork overlaps text at 390, 640, 1280, and 1920 px. Checked with axe and a bounding-box test.
- **AC2.** Each banner's index number sits on its title's right edge at 1280 px.
- **AC3.** Under 640 px, category rows use a 2×2 grid. From 640 px up, they use three tiles.
- **AC4.** WCAG 2.2 AA holds for all text. Decorative art has `aria-hidden="true"` and no focusable children.
- **AC5.** No `innerHTML` (constitution II.3). Components are built with `createElement` and `textContent`.
- **AC6.** Visual baselines change only after the owner's written approval on the PR.

## 5. Process

1. Owner approves this spec (CP8a). Owner answers DQ1 to DQ4.
2. Plan and tasks are written in `plan.md` and `tasks.md`.
3. Claude implements in the existing component files and opens a PR with a deploy preview.
4. Owner reviews the preview at 390, 1280, and 1920 px (CP8b).
5. Owner approves the baseline update in writing on the PR. Merge follows.

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| Placeholder art ships to the live site | DQ1 blocks merge until the owner answers. |
| Copy ships unreviewed | DQ2 blocks merge until each string is approved. |
| Visual regressions in locked areas | AC6 requires written approval for baseline changes. |
| Artwork crops at narrow widths | AC1 checks at four widths, with axe and bounding boxes. |
