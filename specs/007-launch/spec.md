# Spec 007: Launch

| Field | Value |
| --- | --- |
| Status | **Approved (CP7a, 2026-11-07)**: the owner accepted the defaults in §6 |
| Owner | Eric Thayer |
| Amends | [001 spec](../001-timeline-wall/spec.md) US13, FR-061, FR-135 · [002 spec](../002-hero-and-resume/spec.md) FR-124 and the `<noscript>` résumé row · [006 spec](../006-experience-and-projects/spec.md) FR-514 |
| Closes | 001 T074. Part of 001 T073 (VoiceOver only) |
| Companions | [plan.md](./plan.md) · [tasks.md](./tasks.md) · [constitution](../constitution.md) |

## 1. Summary

The site has been live at `ethayer-design.netlify.app` since October, but it hasn't launched: 506 requests reached it in the seven days to 2026-11-07, and it still carries placeholders. This spec defines the smallest product worth sharing:

> A hiring manager can open a link on a phone, see real work, read the résumé, and reach Eric. Eric can update the site, and undo a bad release.

The status check on 2026-11-07 treated CP4b as the critical path. It isn't, for this goal. CP4b gates uploads in `/admin`, and CP4e gates Ask. Neither is needed to launch, because media can still be committed to `media-src/<slug>/` (README, "Add a project").

## 2. Findings this spec acts on

Measured on 2026-11-07 against main at `b38ea3a` (v1.4.0), which is also the production deploy.

| Finding | Evidence |
| --- | --- |
| Drafts are public | The hero says "28 projects", all seven drafts are linked from `/`, and `/work/workbench` shows "Details coming soon." |
| Few cards have real media | Of 21 published cards: 5 real, 7 artwork, 9 placeholder |
| The portrait is a placeholder | Its alt text is "Placeholder for a portrait of Eric Thayer." |
| Canonical URLs use `netlify.app` | `work.ethayer.design` has no DNS record |
| `/resume` has no page of its own | It serves the same 17,130 bytes as `/` |
| No branded 404 | `/nope` shows Netlify's default page. `/work/not-a-project` returns 200 with the home page |
| Slow-to-refresh assets aren't tuned | `/og`, `/media`, and the font are `max-age=0` |
| A bad deploy can go live before tests finish | #17 went live at 21:57:26, and CI finished at 21:59:52. The Netlify build runs no tests |
| Nothing watches production | No uptime check, and no written rollback steps |
| Real-world checks are missing | Lighthouse has never run on production. Only Chromium is verified |

Already passing, so out of scope: unit tests, typecheck, lint, build, budgets, CSP, HSTS, and the secret scan. `npm audit` shows no high or critical issues.

## 3. User stories

### US30 (P1). See only finished work
- **Given** the production site, **then** no draft appears on either view, in the project count, or in Prev/Next.
- **Given** `/admin` or the dev server, **then** drafts still appear, so Eric can finish them.

### US31 (P1). Open the site on its real address
- **Given** `https://work.ethayer.design/`, **then** the site loads with a valid certificate.
- **Given** the old `netlify.app` address, **then** it redirects to the new one, and every canonical URL uses the new one.

### US32 (P1). Share the résumé
- **Given** `/resume` pasted into a chat app, **then** the preview names the résumé, not the home page.
- **Given** JavaScript is off, **then** `/resume` shows the full résumé.
- **Given** JavaScript is on, **then** `/resume` behaves as it does today.

### US33 (P2). Recover from a wrong address
- **Given** an address that doesn't exist, **then** the response is a real 404, in the site's own style, with links back in.

### US34 (P1). Keep the site healthy
- **Given** the site goes down, **then** Eric gets an alert.
- **Given** a bad release, **then** Eric can follow written steps to restore the last good one in under five minutes.

## 4. Functional requirements

### Drafts
- **FR-600** A production build leaves `draft: true` projects out of both views, the hero count, Prev/Next, the prerendered lists, and the sitemap.
- **FR-601** Production emits no `/work/<slug>` page for a draft, so its URL is a 404 (FR-620). This replaces the 001 US13 line "its link still previews" and makes 001 FR-135's `noindex` unreachable in production. In the app, opening a draft's URL on the client takes the existing "Project not found" path.
- **FR-602** The dev server and `/admin` keep showing drafts (006 FR-514).
- **FR-603** Removing `draft: true` publishes a project with no other change.
- **FR-604** This is a display rule, not a privacy boundary. Draft content stays in the public repo and the JS bundle.

### Domain
- **FR-610** `work.ethayer.design` is the primary domain on Netlify, with TLS. The `netlify.app` address redirects to it.
- **FR-611** After the switch, a fresh production build uses the new origin for canonical, `og:url`, sitemap, and `robots.txt` (001 FR-132). `FALLBACK_ORIGIN` in `scripts/lib/origin.ts` is updated to match.

### Résumé page
- **FR-615** `/resume` is prerendered like `/projects`: its own title, description, canonical, and social tags, with the full résumé in `<noscript>`, built from `resume.json` through the escaping helper (001 FR-134).
- **FR-616** It's in the sitemap and gets a forced rewrite like other prerendered pages. The `/resume` rule in `netlify.toml` goes away. This amends 002 FR-124.
- **FR-617** Its social image is `/og/home.png`. A dedicated image can follow later.

### Not found
- **FR-620** The build writes `dist/404.html`, which Netlify serves with status 404. It has an `h1`, one line of copy, and links to Experience, Projects, and Résumé.
- **FR-621** The page is `noindex`, uses the built site CSS and existing tokens only, loads no JavaScript, and is left out of the sitemap and `_redirects`.
- **FR-622** The `/work/*` wildcard leaves `netlify.toml`, so an unknown `/work/<slug>` gets FR-620. This amends 001 FR-061. Client-side navigation to an unknown slug still lands on `/`.

### Caching
- **FR-630** `/og/*`, `/media/*`, and `/fonts/*` send `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`. They aren't `immutable`, because their file names aren't content-hashed. `/assets/*` is unchanged.

### Content
- **FR-640** The footer uses the final portrait (1440 × 1800, `media-src/site/portrait.png`), and `PORTRAIT_ALT` describes it.
- **FR-641** No published `feature`, `wide`, or `tall` card uses a placeholder. Each of the five in §6 LQ2 gets real media, gets artwork, or becomes a draft. `sm` cards may launch with placeholders.
- **FR-642** The owner confirms `HOME_TITLE`, `HOME_DESCRIPTION`, the footer copy, and the résumé. The home description says "fifteen-plus years", while the hero says 2003 to now.

### Operations
- **FR-650** `STATUS.md`, the README, and the task boxes match the repo. Evidence is noted where a box is ticked.
- **FR-651** A [runbook](./runbook.md) covers restoring a deploy, reverting a commit, reverting a bad `/admin` publish, what happens to later deploys after a restore, and who to check first. Netlify's behavior is checked against its docs, and the doc URL is recorded.
- **FR-652** An external monitor requests `/` at least every five minutes and alerts the owner by email. It touches no visitor, so it adds no tracker (constitution VII).
- **FR-653** Netlify emails the owner when a production deploy fails.
- **FR-654** No client-side error reporting or analytics ships with this spec.

## 5. Out of scope

Everything here continues after launch, in the order in [tasks.md](./tasks.md#after-launch).

- `/admin` uploads and spec 004 completion: T329, CP4b, T389, T394, T396, CP4e.
- Netlify production commit statuses. T396 can't pass without them, so they must be solved before T396, not before launch.
- Ask (spec 005).
- Visual baselines, Firefox and WebKit in CI, and Lighthouse CI (T072). Baselines wait for real images. `tests/visual/` doesn't exist yet, so constitution I.2 isn't enforced until they land.
- NVDA (T073), the era rail (T075), and `check-frameable.ts` plus generated `frame-src` (T077).
- Branch protection on `main`. `/admin` publishes directly to it, so this needs its own decision.
- Feature flags, canary rollout, and error budgets. A static site with one owner gets its safety from deploy restore.
- A licensed typeface, rotating Swiss artwork. Both stay as they are.

## 6. Owner decisions

The owner accepted every answer below at CP7a (2026-11-07).

| # | Question | Answer |
| --- | --- | --- |
| LQ1 | Should drafts leave production, as in FR-600 and FR-601? | Yes. Alternatives: finish all seven before launch, or keep direct links working |
| LQ2 | What happens to each of the five large placeholder cards (table below)? | Real media if ready, otherwise draft |
| LQ3 | Is `work.ethayer.design` still the address? | Yes (001 Q4) |
| LQ4 | Which uptime monitor? | Any free external monitor with email alerts. The owner creates the account |
| LQ5 | Does the home description change to match 2003 to now? | The owner supplies the wording at T608 |

**LQ2 cards**

| Project | Era | Size | Note |
| --- | --- | --- | --- |
| `cobank-design-system` | cobank | feature | The largest card from the current employer. Screenshots need clearance |
| `figma-token-pipeline` | cobank | wide | Needs clearance if it shows CoBank work |
| `kyamedia-frameworks` | independent | wide | |
| `vr-design-system` | health-scholars | tall | A Unity capture is on the owner's list |
| `dli-mobile-learning` | dli | tall | |

Hiding or restyling cards can change how the wall balances. The `swiss-share` warning (20–30 %) won't show this fully, so T607 checks the wall as visitors see it.

## 7. Success criteria

- **SC-L1** Production shows 0 drafts, and the hero count equals the published count.
- **SC-L2** `https://work.ethayer.design/` serves every route over valid TLS, and `curl` finds no `netlify.app` URL in its canonical tags, sitemap, or `robots.txt`.
- **SC-L3** With JavaScript off, `/resume` shows the full résumé.
- **SC-L4** `/nope`, `/work/not-a-project`, and a draft's URL return 404 with the branded page.
- **SC-L5** Lighthouse on mobile, on production, for `/`, `/projects`, `/work/dmns`, and `/resume`: LCP ≤ 2.5 s, CLS ≤ 0.05, Perf ≥ 90, A11y = 100, Best Practices ≥ 95 (constitution V). Any miss comes to the owner at CP7c as fix or accept.
- **SC-L6** The core path works on iPhone Safari, desktop Safari, and desktop Firefox: open the site, open a project, close it, open the résumé, follow Email.
- **SC-L7** A VoiceOver pass over the same path finds no blocking issue.
- **SC-L8** Link previews show the right title and image in Slack, LinkedIn, and iMessage.
- **SC-L9** The monitor has fired one test alert, and the runbook's restore has been done once.

## 8. Checkpoints

- **CP7a** (approved, 2026-11-07): the owner approves this spec and answers §6. No code starts before this.
- **CP7b**: the owner reviews the deploy preview: drafts gone, `/resume`, the 404 page, and final content. The 404 page is a new layout, so approval locks it.
- **CP7c**: go or no-go on production, after every success criterion is reported. Sharing starts only after this.
