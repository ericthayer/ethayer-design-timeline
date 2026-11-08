# Plan 007: Launch

Companion to [spec.md](./spec.md). This says how; the spec says what and why.

## 1. Approach

Add almost nothing. The prerender plugin already writes per-route pages, the sitemap, and `_redirects`, so `/resume` and the 404 page are two more outputs. Hiding drafts is two filters. The rest is settings, content, and checks.

```
src/core/drafts.ts                  FR-600, FR-602  new: visibleProjects(projects, { includeDrafts })
src/main.ts                         FR-600–FR-602   filter before VIEWS is built
scripts/vite-prerender.ts           FR-600, FR-620  filter before buildPages; write 404.html
scripts/lib/pages.ts                FR-615          add the /resume page to buildPages
scripts/lib/resume-page.ts          FR-615          new: static résumé body
scripts/lib/not-found-page.ts       FR-620, FR-621  new: standalone 404 document
scripts/lib/origin.ts               FR-611          FALLBACK_ORIGIN
netlify.toml                        FR-616, FR-622, FR-630  drop 2 rules, add cache headers
src/components/site-footer/         FR-640          PORTRAIT_ALT
tests/unit/, tests/e2e/             all             new behavior, and draft-aware counts
specs/007-launch/runbook.md         FR-651          new
```

`scripts/lib/pages.ts` is already 342 lines, so the new pages get their own modules, like `projects-page.ts`.

## 2. Key decisions

| Decision | Choice | Rejected, and why |
| --- | --- | --- |
| Draft URLs in production | No page, so a 404 | Keep them reachable: `openProject` looks in the visible sequence, so this needs a second lookup and a dialog state with no neighbors, for links nobody should be sharing yet |
| Where the draft rule lives | One pure function, used by the app and the build | Filtering at each call site: two copies of a rule that must agree |
| Showing drafts on deploy previews | No, a preview matches production. Review drafts in `/admin` or dev | A preview-only flag: CP7b would review something production doesn't show |
| `/resume` with JavaScript on | Unchanged: the wall loads and the dialog opens | A standalone page: a second résumé layout, which the design lock would have to review |
| Résumé social image | Reuse `/og/home.png` | A new card now: the OG template is locked, and the title and description matter most |
| 404 page | A standalone document with no JavaScript | Reusing the app shell: `main.ts` would boot and send an unknown path to `/` |
| Cache lifetime | One day, plus a week of `stale-while-revalidate` | `immutable`: file names aren't hashed, so replacing a cover or the font would serve the old one |
| Monitoring | One external ping and Netlify's deploy email | Error-tracking SDKs: they break the zero-dependency and no-tracker rules. Netlify's request logs are already there for investigating |
| Safety net | Restore the previous Netlify deploy | Making Netlify wait for CI: a larger change to the deploy path, and it would slow `/admin` publishes |

## 3. Draft filtering

```ts
export function visibleProjects(
  projects: readonly Project[],
  options: { readonly includeDrafts: boolean },
): readonly Project[];
```

- **App:** `main.ts` already computes `routerBase(location.pathname)`. It passes `includeDrafts: import.meta.env.DEV || base !== ''`, so `/admin` and dev keep drafts. The filter runs before `VIEWS` is built, so the hero count, Prev/Next, and both views follow without further changes.
- **Build:** `vite-prerender.ts` filters `content.value.projects` before calling `buildPages`. Pages, sitemap, and `_redirects` follow.
- **Left alone:** `public/og/*.png` and `og-manifest.json` stay complete, so `npm test` doesn't need new images, and removing `draft: true` needs no second step.

The public JS size shouldn't change, because the content is still bundled (FR-604).

## 4. Tests

- **Counts:** e2e runs against a production build, so the hard-coded 28s in `wall`, `projects`, `prerender`, and `dialog` specs become the published count. Derive it from content rather than typing a new number. LQ2 can still change it.
- **Prerender:** the FR-135 unit tests move to the rule that no draft page is built. `shows the draft note only on drafts` stays for `/admin`, unless the note's static branch has become unreachable, in which case that branch goes.
- **Admin:** add one e2e proving a draft still appears in `/admin`.
- **Netlify rules:** `vite preview` doesn't read `_redirects` or `netlify.toml`, so the local `/work/not-a-project` tests keep passing as client-side behavior. Real 404s are checked with `curl` on the deploy preview.
- **Axe:** add `/resume` with JavaScript off and the 404 page.
- **Baselines:** none exist, and this spec creates none.

## 5. Domain sequence

`ethayer.design` is on Netlify DNS, so the owner adds `work.ethayer.design` in the Netlify UI and sets it as primary.

1. Add the domain and wait for TLS.
2. Trigger a production deploy. Canonical URLs are written at build time, so nothing changes until a new build runs.
3. Check with `curl` that the home page, sitemap, and `robots.txt` use the new origin, and that `netlify.app` redirects.

`/admin` sessions are per origin, so the owner signs in again on the new address.

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| Hiding cards leaves an era thin, or empties it | T607 reviews the wall after LQ2. If an era marker is left with no cards, stop and ask the owner |
| LQ2 raises a `swiss-share` or `standard-run` warning | They're warnings, not build failures, and they count every project in `order.json`. Decide from the wall as visitors see it, and take any conflict to the owner |
| Removing the `/work/*` wildcard breaks a deep link | Prerendered pages use forced rules. Check `/work/dmns` and a project with `draft` just removed on the preview |
| A cached `netlify.app` preview survives the switch | Launch hasn't been announced, so few exist. T615 tests previews on the new domain |
| Real content pushes LCP over budget | Measured at T614 after final content lands, not before |
| Netlify's restore behavior differs from what the runbook assumes | T611 checks the docs, and T612 does a real restore before anyone is sent the link |
