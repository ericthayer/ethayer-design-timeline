---
state: active
updated: 2026-11-01
updatedBy: claude
---

## Left off

- v1, the hero and résumé (spec 002), the Batch B artwork and gallery (spec 003), and the prerender and link previews (T070, T071) are merged to main.
- Spec 004 (admin editing) parts 1 and 2 are merged to main: PR #6 (content as JSON, build-time media, `/admin` sign-in) and PR #7 (`github-publish`).
- PR #8 (release-please and commitlint) was closed unmerged on purpose. Keep using Conventional Commit messages and squash merges. A small tag-on-merge release workflow is undecided (first tag `v1.0.0` or `v0.x`).
- PR #9, #10 and #11 are merged. #11 added `scripts/smoke-publish.ts`.
- CP4d smoke publish passed on 2026-11-01 against `ericthayer/admin-sandbox`: create (JSON + image), update and delete each made one commit, JSON read-backs matched with UTF-8 intact, the `sha: null` delete worked, and deploy status read `queued → unknown: timeout`.
- The PR #5 post-deploy smoke test passed on production on 2026-10-24 (steps 1–5). It turned up one console error, now follow-up 1.

## Next step

- The owner approved CP1–CP3, CP4a and CP4c on 2026-10-24. The current design is locked (constitution I).
- The owner approved CP4d on 2026-11-01. `edit-layer` (T380+) can start, on a branch from `origin/main`.
- CP4b is still open, and T389 uploads wait for it.
- Spec 005 (Ask) was approved on 2026-11-01 with all of AQ1–AQ9 answered (Claude Haiku 5.5, a $20 monthly cap, no question logging), and constitution amendments A1 and A2 are applied. Pure core T400–T403 may run now. Everything visible waits for CP4e.

## Blockers

- T389 uploads (edit-layer) are blocked until CP4b is approved.

## Waiting on

- Owner: CP4b (review the media-pipeline deploy preview, the migration manifest diff and the timings, and answer MQ1–MQ4)
- Owner: the original cover images for `media-src/<slug>/` (D5)

## CP4d smoke publish

Done 2026-11-01 and approved. Kept so the run can be repeated against the scratch repo.

`scripts/smoke-publish.ts` (PR #11) calls the real `github-publish` module against a scratch repo, because `/admin` only signs in to the site repo. It refuses the site repo and classic `ghp_` tokens, and never prints the token.

1. Create a **private** repo `ericthayer/admin-sandbox` with a README, so `main` exists. No rulesets or branch protection.
2. Create a fine-grained token for that repo only: Contents **Read and write**, Commit statuses **Read-only**, 7-day expiry.
3. From a checkout of PR #11 (or `main` once merged), with Node 22.18 or later and no install needed:
   ```bash
   ADMIN_SANDBOX_TOKEN=github_pat_… node scripts/smoke-publish.ts
   ```
4. Expect, in order, each with a commit URL: `readHead`, a create commit (`src/content/data/projects/smoke-test.json` plus `media-src/smoke-test/cover.png`), a `readFile` round-trip with "é", an update and read-back, a delete of the JSON and folder ending in `not-found`, then `watchDeploy` for about 12 s ending `queued → unknown: timeout` (there is no Netlify on the scratch repo).
5. If it fails: `unauthorized` means a wrong or expired token, `no-access` on the deploy step means Commit statuses isn't Read-only. `SMOKE_REPO=owner/name` points it at another scratch repo.
6. Paste the output into the PR #11 thread or the project, then revoke the token. The repo can stay for later runs or be deleted.

A clean run plus review of the API and tests is what CP4d needs.

## Open decisions

- License a face like Neue Haas Unica later? Hanken Grotesk is locked for now by the CP1 approval, so switching would be an owner-approved design change. · since 2026-10-23
- Swiss artwork: keep the fixed assignment (14 motifs in use), or rotate which cards get one? · since 2026-10-23
- A static `/resume` page for visitors without JavaScript and for link previews (PR #5 left it out; `/resume` previews as the home card) · since 2026-10-24
- Turn on Netlify's GitHub commit-status notifications for production deploys? Netlify posts `deploy/netlify` statuses only on deploy previews, so after a real `/admin` publish to `main`, `watchDeploy` ends with `unknown: timeout` (found in PR #11). · since 2026-10-25

## Follow-ups

In the order I'd do them. Checked against the repo and production on 2026-10-24.

**Verify what shipped**

Done 2026-10-24: the PR #5 smoke test on production. (1) `/work/dmns` has its own title, canonical, `og:image` and `twitter:image`. (2) `/og/dmns.png` and `/og/home.png` are 1200×630 PNGs. (3) `sitemap.xml` (22 URLs) and `robots.txt` return 200, the seven drafts are absent from the sitemap, and `/work/workbench` is `noindex`. (4) `/work/not-a-project` falls back to the app and lands on `/`. (5) The deep link opens the dialog, and Escape restores the home title, the `/` URL, and focus on the card.

1. An unhandled `InvalidStateError: Transition was aborted because of invalid state` appeared once on production around a deep-linked dialog. Chrome rejects `transition.ready` when it skips a View Transition (for example in a background tab), and `src/core/transition.ts` didn't handle that rejection. Nothing visible breaks. The fix and its unit test shipped in PR #9 (merged).
2. Paste a project URL into Slack, LinkedIn and iMessage, and try LinkedIn's Post Inspector. Use a URL they haven't cached. (Owner)

**Spec 004**

3. Owner sign-off on CP4b. (CP4a and CP4c were approved on 2026-10-24, CP4d on 2026-11-01.)
   - Open from CP4d: Netlify's commit status context on the real site (FR-375) and an image read-back in the smoke script. Verify both on the first real publish.
4. `edit-layer` (T380–T396), on a branch from `origin/main`. T389 uploads also wait for CP4b.
5. `content-json` T312 and T313: delete the old TS project modules once the migration test has passed in CI.
6. Media T327–T329: collect the Netlify plugin cache and CI cache evidence.
7. Per-module budget baselines. The admin isolation WARN reports +565 B against FR-358's +307 B.

**Small gaps**

8. Static `/resume` page, about half a day. It is probably the most-shared link.
9. Cache headers, about 10 minutes. Only `/assets/*` is immutable. `/og`, `/media` and the fonts are `max-age=0`. The font file is not content-hashed, so use a day or a week with `stale-while-revalidate`, not `immutable`.
10. Check that `HOME_TITLE` and `HOME_DESCRIPTION` say what you want in a share.

**Planned, not started**

11. Screenshot baselines at 390, 1280 and 1920 px (part of T072). CP1 was approved on 2026-10-24, so the baselines are unblocked.
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

**Spec 005 (Ask)**

- Owner: draft `about.json` and 8–16 suggestion chips with answers (T399). This can start any time.
- T400–T403 (pure core) on `claude/project-thread-vg1394` after the spec PR #12 merges. T404+ waits for CP4e. Phase 2 also needs a dedicated Anthropic workspace with the $20 limit (T427).

**Housekeeping**

- Lint and format hooks: content and code now come from several parallel branches.
