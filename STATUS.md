---
state: active
updated: 2026-10-24
updatedBy: claude
---

## Left off

- v1, the hero and résumé (spec 002), the Batch B artwork and gallery (spec 003), and the prerender and link previews (T070, T071) are merged to main.
- Spec 004 (admin editing) part 1 is in PR #6: content as JSON, build-time media, and `/admin` sign-in.
- `github-publish` (spec 004) is being built next. `edit-layer` comes after it.

## Next step

- Review the PR #6 deploy preview. Run the post-deploy smoke test from PR #5, and sign in at `/admin` with a fine-grained token.
- Then review `github-publish` (CP4d).

## Blockers

- None

## Waiting on

- Owner: the CP4a–CP4c reviews on PR #6, and the original cover images for `media-src/<slug>/` (D5)

## Open decisions

- CP1 (v1 design lock and visual baselines) was never formally approved, and the design has changed since (hero, palette, gallery). Approve the current design so baselines can be taken? · since 2026-10-23
- Keep Hanken Grotesk, or license a face like Neue Haas Unica? · since 2026-10-23
- A static `/resume` page for visitors without JavaScript and for link previews (PR #5 left it out) · since 2026-10-24
