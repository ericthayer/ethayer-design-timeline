# Tasks — 007 Launch

Legend as in [001 tasks](../001-timeline-wall/tasks.md). Each task is done when `npm run check` passes. UI tasks also need `npm run budgets` and `npm run e2e`. **(owner)** marks a step only the owner can do. One task per commit, citing its ID.

- [x] **T600** Spec 007, plan, and tasks written from the 2026-11-07 launch review. → §1–§8
- [x] **CP7a** (approved by the owner, 2026-11-07, with the default answers to LQ1–LQ5) Owner approves the spec and answers LQ1–LQ5.

Nothing below starts until CP7a is approved.

**Records**

- [x] **T601** Correct the records. Tick T328 (CI run `41354596319` logs `encoded: 0, cached: 9`) and T351 (e2e passes in that run). Note on T327 that the code shipped in `660eaa6` and only its deploy-log check is open. Rewrite `STATUS.md` around spec 007, and fix the README status line. → FR-650
  - Done when: nothing in `STATUS.md` or the README contradicts the repo, and 007 is named as the active feature.

**Domain**

- [ ] **T602** (owner) Add `work.ethayer.design` on Netlify, set it as primary, and wait for TLS. → FR-610
  - Done when: the site loads on the new address, and `netlify.app` redirects to it.
- [x] **T603** Update `FALLBACK_ORIGIN`, trigger a production deploy, and verify plan §5. → FR-611, SC-L2
  - Done when: `curl` finds no `netlify.app` URL in the home page's canonical tag, the sitemap, or `robots.txt`.

**Build**

- [x] **T604** Hide drafts: `visibleProjects()` with unit tests, wired into `main.ts` and `vite-prerender.ts`, with draft-aware counts in e2e. → FR-600–FR-604, plan §3, §4, SC-L1
  - Done when: the hero count equals the published count, no draft page is built, and a new e2e shows a draft in `/admin`.
- [x] **T605** Static `/resume`: `resume-page.ts`, the page in `buildPages`, the `netlify.toml` rule removed, unit tests, and axe with JavaScript off. → FR-615–FR-617, SC-L3
  - Done when: `dist/resume.html` has its own head tags and the full résumé in `<noscript>`, and the JavaScript path still passes `resume.spec.ts`.
- [ ] **T606** The 404 page and cache headers: `not-found-page.ts`, the `/work/*` rule removed, unit tests, axe, and FR-630 in `netlify.toml`. → FR-620–FR-622, FR-630
  - Done when: on the deploy preview, `curl` shows 404 for `/nope`, `/work/not-a-project`, and a draft's URL, 200 for `/work/dmns`, and the new `Cache-Control` on one file each under `/og`, `/media`, and `/fonts`. SC-L4 is checked on production at T613.

**Content**

- [ ] **T607** (owner, with Claude committing) Apply LQ2 to the five large cards: add media to `media-src/<slug>/`, or change the card, or set `draft: true`. Run `npm run content:check` after each. Review the wall per plan §6. → FR-641
  - Done when: no `feature`, `wide`, or `tall` published card has `kind: placeholder`.
- [ ] **T608** (owner) Supply the final portrait and alt text, and confirm `HOME_TITLE`, `HOME_DESCRIPTION` (LQ5), the footer copy, and the résumé. Claude commits them. → FR-640, FR-642
  - Done when: the alt text no longer says "Placeholder", and the owner has confirmed each item.
- [ ] **T609** Open a PR with T604–T608 on a deploy preview. Report drafts, `/resume`, the 404 page, and the wall at 390, 1280, and 1920 px for review.
- [ ] **CP7b** Owner reviews the deploy preview. Approval locks the 404 page.

**Operations**

- [ ] **T610** (owner) Create the uptime monitor for `/`, turn on Netlify's failed-deploy email, and send one test alert. Nothing is added to the client. → FR-652–FR-654
  - Done when: the test alert reached the owner's inbox.
- [x] **T611** Write `specs/007-launch/runbook.md`, and link it from the README. Check Netlify's restore behavior against its docs and record the URL. → FR-651
  - Done when: each step names the exact place to click or command to run, including what happens to the next deploy after a restore.
  - Evidence: [runbook.md](./runbook.md), checked against Netlify's "Manage deploys" page on 2026-11-07. Two points the docs don't settle (whether a restore locks on its own, and what unlocking publishes) are handled by explicit steps, and T612 confirms them.
- [ ] **T612** (owner, with Claude) Merge the CP7b PR, then do one real restore and roll it forward, following the runbook as written. Fix any step that was wrong. → SC-L9
  - Done when: the time to restore is recorded, and production is back on the latest deploy.

**Verify**

- [ ] **T613** Run the production `curl` list again on the new domain: routes, 404s, headers, sitemap count, and JavaScript-off `/resume`. → SC-L1–SC-L4
- [ ] **T614** Lighthouse, mobile, on production, for the four routes, with results recorded here. → SC-L5
- [ ] **T615** (owner) Test iPhone Safari, desktop Safari, desktop Firefox, and a VoiceOver pass over the core path, then paste a URL into Slack, LinkedIn (Post Inspector), and iMessage. → SC-L6–SC-L8
- [ ] **T616** Report every SC-L result, with any miss listed as fix or accept.
- [ ] **CP7c** Owner gives go or no-go.

**Launch**

- [ ] **T617** (owner) Link the site from `ethayer.design` and LinkedIn, and share it.
- [ ] **T618** First-hour check, then one week later: monitor, Netlify 4xx and 5xx counts, and anything visitors report. Tick T074, note VoiceOver on T073, and update `STATUS.md`.

## After launch

In this order. These tasks already exist in their own specs.

1. T329, then close T327 and T352: read the deploy logs, drop a test image on a preview, and confirm T352's acceptance.
2. CP4b, then T389 and T394.
3. Netlify production commit statuses. `b38ea3a` has none, so T396's badge can't reach Live until this is solved.
4. T396, then CP4e. A text-only publish needs nothing from CP4b and can be tried any time, but expect `unknown: timeout` until step 3 is done.
5. Replace the remaining `sm` placeholders, and finish the drafts in `/admin`.
6. T072: visual baselines at 390, 1280, and 1920 px, then Firefox, WebKit, and Lighthouse in CI.
7. Ask Phase 1 (T404–T410).
8. T073 (NVDA), T075, T077.
