---
state: active
updated: 2026-11-07
updatedBy: claude
---

## Left off

- **Active feature: [spec 007, Launch](specs/007-launch/spec.md).** The owner approved CP7a on 2026-11-07 with the default answers to LQ1–LQ5. T601 corrected these records.
- Main is at `b38ea3a` (v1.4.0), and production is on that commit. CI is green, with 686 unit tests and 93 e2e tests passing. No PRs are open.
- Merged: specs 001–003, spec 006, the prerender and link previews, spec 004 `content-json`, `admin-auth`, `github-publish`, and the `edit-layer` work through T395 (#17), and the Ask pure core and draft content (#18, #19).
- Releases are tag-on-merge from the squash commit subject (`.github/workflows/release.yml`). `v1.0.0` through `v1.4.0` are tagged.

## Next step

- T602 (owner): add `work.ethayer.design` on Netlify, set it as primary, and wait for TLS.
- Then T603–T618, in order, from [007 tasks](specs/007-launch/tasks.md).

## Blockers

- `/admin` uploads (T389) wait for CP4b. This doesn't block launch: media can be committed to `media-src/<slug>/`.
- Netlify posts no commit statuses on production deploys, so T396's badge can't reach Live until this is solved. This is also after launch.

## Waiting on

- Owner: T602, the domain.
- Owner, for launch: T607 (the five large placeholder cards), T608 (final portrait and alt text, then confirm the home title and description, the footer copy, and the résumé), T610 (uptime monitor and failed-deploy email), and T615 (device, VoiceOver, and link-preview checks).

## Open decisions

- Should a licensed face like Neue Haas Unica replace Hanken Grotesk later? It stays for launch (007 §5). Switching would be an owner-approved design change. · since 2026-10-23
- Should the Swiss artwork stay fixed, or should the cards that get one rotate? It stays fixed for launch (007 §5). · since 2026-10-23
- How should production get deploy status for `/admin`? Netlify's commit statuses, or something else? Needed before T396. Found in PR #11. · since 2026-10-25
- Should `main` get branch protection? `/admin` publishes directly to it, so a rule would need a bypass (007 §5). · since 2026-11-07

Resolved: a static `/resume` page is part of spec 007 (FR-615).

## After launch

The order is in [007 tasks](specs/007-launch/tasks.md#after-launch): T329 and CP4b, T389 and T394, production deploy status, T396 and CP4e, the remaining placeholders and drafts, T072, Ask Phase 1, then T073 (NVDA), T075, and T077.

Other notes:

- T327's code is shipped, but its deploy-log acceptance is unread. T352's acceptance still needs confirming.
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
