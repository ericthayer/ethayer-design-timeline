---
state: active
updated: 2026-11-08
updatedBy: claude
---

## Left off

- **Active feature: [spec 007, Launch](specs/007-launch/spec.md).** The owner approved CP7a on 2026-11-07 with the default answers to LQ1–LQ5.
- The site is live on `work.ethayer.design` (T602, T603). Production is on `6db2435` (latest tag `v1.5.2`). No PRs are open.
- Done for launch: drafts hidden, static `/resume`, the 404 page and cache headers (T604–T606), the rollback runbook (T611), the production `curl` list (T613), and Lighthouse on production (T614: Performance 99–100 on all four routes, CLS 0; the skip-link fix shipped in #26).
- T607 decided 2026-11-08 (owner): the five large cards keep placeholders at launch, and real media comes through `/admin` once the CMS works. The Swiss share is accepted at about 33 %.
- Merged earlier: specs 001–003 and 006, spec 004 `content-json`, `admin-auth`, `github-publish`, and `edit-layer` through T395 (#17), and the Ask pure core and draft content (#18, #19). Releases are tag-on-merge (`.github/workflows/release.yml`).

## Next step

- T608 (owner): supply the final portrait (1440 × 1800) and its alt text, and confirm `HOME_TITLE`, `HOME_DESCRIPTION`, the footer copy, and the résumé. Claude then commits them and opens the T609 deploy-preview PR for CP7b.

## Blockers

- `/admin` uploads (T389) wait for CP4b. This doesn't block launch: media can be committed to `media-src/<slug>/`.
- Netlify posts no commit statuses on production deploys, so T396's badge can't reach Live until this is solved. This is also after launch.

## Waiting on

- Owner, for launch: T608 (portrait, alt text, and copy confirmations), T610 (uptime monitor and failed-deploy email), and T615 (device, VoiceOver, and link-preview checks). Then CP7b and CP7c.

## Open decisions

- Should a licensed face like Neue Haas Unica replace Hanken Grotesk later? It stays for launch (007 §5). Switching would be an owner-approved design change. · since 2026-10-23
- Should the Swiss artwork stay fixed, or should the cards that get one rotate? It stays fixed for launch (007 §5). · since 2026-10-23
- How should production get deploy status for `/admin`? Netlify's commit statuses, or something else? Needed before T396. Found in PR #11. · since 2026-10-25
- Should `main` get branch protection? `/admin` publishes directly to it, so a rule would need a bypass (007 §5). · since 2026-11-07

Resolved: a static `/resume` page is part of spec 007 (FR-615).

## After launch

The order is in [007 tasks](specs/007-launch/tasks.md#after-launch): T329 and CP4b, T389 and T394, production deploy status, T396 and CP4e, the remaining placeholders and drafts, T072, Ask Phase 1, then T073 (NVDA), T075, and T077.

Other notes:

- T327's code is shipped, and production deploy `6aefed03` reports `plugin_state: success`, so Netlify loads the plugin. The cache-restore and `encoded: 0` lines are in the deploy log, which only the owner's Netlify dashboard shows (T329). T352's acceptance still needs confirming.
- Open from CP4d: an image read-back in the smoke script, on the first real publish.
- Owner, for spec 005: check the T399 wording, and add any personal topics to `about.json`. Phase 2 needs a dedicated Anthropic workspace with the $20 limit (T427).
- Owner assets: the Unity capture of the VR design system, the motion-reel source for an 8-second loop, and CoBank and Threecolts screenshots if cleared.
- `check-budgets` warns that initial JS is +2,205 B over its old baseline (FR-358 allows +307 B). The baseline is stale. Initial JS is 21.2 of 25 KB.
- Lint and format hooks: content and code come from several parallel branches.

## CP4d smoke publish

Done 2026-11-01 and approved. Kept so the run can be repeated against the scratch repo.

`scripts/smoke-publish.ts` (PR #11) calls the real `github-publish` module against a scratch repo, because `/admin` only signs in to the site repo. It refuses the site repo and classic `ghp_` tokens, and never prints the token.

1. Create a **private** repo `ericthayer/admin-sandbox` with a README, so `main` exists. No rulesets or branch protection.
2. Create a fine-grained token for that repo only: Contents **Read and write**, Commit statuses **Read-only**, 7-day expiry.
3. With Node 22.18 or later and no install needed:
   ```bash
   ADMIN_SANDBOX_TOKEN=github_pat_… node scripts/smoke-publish.ts
   ```
4. Expect, in order, each with a commit URL: `readHead`, a create commit (`src/content/data/projects/smoke-test.json` plus `media-src/smoke-test/cover.png`), a `readFile` round-trip with "é", an update and read-back, a delete of the JSON and folder ending in `not-found`, then `watchDeploy` for about 12 s ending `queued → unknown: timeout` (there is no Netlify on the scratch repo).
5. If it fails: `unauthorized` means a wrong or expired token, `no-access` on the deploy step means Commit statuses isn't Read-only. `SMOKE_REPO=owner/name` points it at another scratch repo.
6. Paste the output into the project, then revoke the token. The repo can stay for later runs or be deleted.
