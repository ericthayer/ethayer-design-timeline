---
state: active
updated: 2026-10-24
updatedBy: claude
---

## Left off

- v1, the hero and résumé (spec 002), the Batch B artwork and gallery (spec 003), and the prerender and link previews (T070, T071) are merged to main.
- Spec 004 (admin editing) part 1 is in PR #6: content as JSON, build-time media, and `/admin` sign-in. Read-only tokens are refused and Sign out works inside a project dialog.
- `github-publish` (spec 004) is in PR #7. It is retargeted to `main` so Netlify builds a preview. `edit-layer` comes after it.

## Next step

- Merge #6, then review the #7 deploy preview and merge it (CP4d: scratch-repo smoke publish).
- Then work the follow-ups below, in order.

## Blockers

- None

## Waiting on

- Owner: the CP4a–CP4c reviews on PR #6, the CP4d review on PR #7, and the original cover images for `media-src/<slug>/` (D5)

## Open decisions

- CP1 (v1 design lock and visual baselines) was never formally approved, and the design has changed since (hero, palette, gallery). Approve the current design so baselines can be taken? · since 2026-10-23
- Keep Hanken Grotesk, or license a face like Neue Haas Unica? · since 2026-10-23
- Swiss artwork: keep the fixed assignment (14 motifs in use), or rotate which cards get one? · since 2026-10-23
- A static `/resume` page for visitors without JavaScript and for link previews (PR #5 left it out; `/resume` previews as the home card) · since 2026-10-24

## Follow-ups

In the order I'd do them. Checked against the repo and production on 2026-10-24.

**Verify what shipped**

1. Run the six-step post-deploy smoke test from PR #5. Spot checks pass: `/`, `/work/workbench`, `/og/home.png` and `sitemap.xml` (22 URLs) return 200.
2. Paste a project URL into Slack, LinkedIn and iMessage, and try LinkedIn's Post Inspector. Use a URL they haven't cached. (Owner)

**Spec 004**

3. Merge #6 and #7. Owner checkpoints: CP4a–CP4c, CP4d.
4. `edit-layer` (T380–T396), stacked on `main` after #7.
5. `content-json` T312 and T313: delete the old TS project modules once the migration test has passed in CI.
6. Media T327–T329: collect the Netlify plugin cache and CI cache evidence.
7. Per-module budget baselines. The admin isolation WARN reports +565 B against FR-358's +307 B.

**Small gaps**

8. Static `/resume` page, about half a day. It is probably the most-shared link.
9. Cache headers, about 10 minutes. Only `/assets/*` is immutable. `/og`, `/media` and the fonts are `max-age=0`. The font file is not content-hashed, so use a day or a week with `stale-while-revalidate`, not `immutable`.
10. Check that `HOME_TITLE` and `HOME_DESCRIPTION` say what you want in a share.

**Planned, not started**

11. CP1 sign-off, then screenshot baselines at 390, 1280 and 1920 px. (Needs the type decision)
12. T072: Firefox and WebKit e2e and Lighthouse thresholds in CI. Only Chromium is verified.
13. T073: manual screen-reader pass (VoiceOver and NVDA).
14. T074: custom subdomain (`work.ethayer.design`). The site is live at `ethayer-design.netlify.app`.
15. T075 (optional): era rail.
16. T077: `scripts/check-frameable.ts`, a weekly job that flags when DMNS, MadRamps or QR Landing start blocking framing, and `frame-src` generated from content.

**Content only the owner can supply** (drop files in `media-src/<slug>/`, D5)

17. Original cover images for every project (D5).
18. Unity capture of the VR design system, and the motion-reel source for an 8-second loop.
19. CoBank and Threecolts screenshots, if you're cleared to show them.
20. Copy and dates for the seven drafts: `curiteva`, `madramps`, `motion-reel`, `qr-landing`, `map-course-launcher`, `safetyhive`, `workbench`. They stay `noindex` until `draft: true` is removed, which will be possible in `/admin` once `edit-layer` ships.

**Housekeeping**

- Lint and format hooks: content and code now come from several parallel branches.
