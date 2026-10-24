# Capability map — 004 Admin editing (Approach A)

| Field | Value |
| --- | --- |
| Status | **Approved (2026-10-24)** by the owner, with the answers in §Resolved questions |
| Owner | Eric Thayer |
| Decision | Approach A from the 2026-10-24 brainstorm: an edit layer built into the site at `/admin`, signed in with GitHub, with in-place editing in the project dialog. Publish commits to the repo and Netlify rebuilds (about 1–2 minutes) |
| Rejected | B (TinaCMS: a separate React admin, a hosted service, and a very new plain-HTML bridge). C (Sveltia CMS: forms only, no edit-in-place). Decap with Netlify Identity (Identity deprecated 2025-02-28) |

## Modules

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| `content-json` | Move projects, résumé, site, and era content from TS modules to JSON files. Add a shared validator (pure TS, used by tests, the build, and the editor) that enforces today's FR-091 and spec 003 rules. A failed validation **fails the build**, so the live site never changes | — |
| `media-pipeline` | Turn raw uploads into the optimized AVIF/WebP sizes and the manifest at **build time** on Netlify, using the existing `scripts/optimize-images.ts` and sharp | — |
| `admin-auth` | The `/admin` entry point. The admin bundle loads only on that path. GitHub sign-in (v1: a fine-grained token limited to this repo's contents, kept for the browser session). Sign out, and token checks. A CSP that lets only `/admin` reach `api.github.com` | — |
| `github-publish` | Turn a set of changed files (JSON and media) into **one atomic commit** on `main` through the GitHub Git Data API. Detect conflicts (the remote changed since the editor loaded) and report status | `admin-auth`, `content-json` |
| `edit-layer` | The editing UI: a toolbar island, edit-in-place on project dialog fields, gallery tile editing and media upload, dirty-state tracking, validation messages from the shared validator, a local draft that survives reload, and Publish → `github-publish` | `content-json`, `github-publish`, `media-pipeline` |

Build order: `content-json`, `media-pipeline`, `admin-auth` (independent, any order) → `github-publish` → `edit-layer`

Each module then gets its own spec → plan → tasks under this folder (`spec-<module-id>.md`, `plan-<module-id>.md`, `tasks-<module-id>.md`). This map is the index.

## Boundaries between modules

- `content-json` owns the content **schema and validator**. Everything else imports them, and none of them redefine the rules.
- `github-publish` knows nothing about the UI. It takes `{ path, content }[]` plus a message and returns a commit or a typed error.
- `edit-layer` never talks to GitHub directly, and never ships to public visitors.
- `media-pipeline` doesn't depend on the editor. Dropping a raw image into the repo by hand works too.

## Constitution check

| Rule | How this design holds it |
| --- | --- |
| II.2 zero runtime deps | The admin is vanilla TS custom elements. `fetch` to the GitHub REST API needs no SDK |
| II.4 lazy heavy code | The admin is a dynamic `import()` taken only on `/admin`. The public bundle grows by a route check only |
| VII CSP and privacy (NFR-06) | Public pages keep today's CSP, and public visitors make no third-party requests. `connect-src https://api.github.com` applies to `/admin` only |
| II.3 no `innerHTML` | The editor uses `textContent`, `contenteditable` with plain-text reads, and form controls |
| IV a11y | The toolbar and editors are keyboard operable, with labeled fields and visible focus. axe runs on `/admin` too |
| V budgets | The initial public JS stays under 25 KB, and the public budgets don't change. The admin chunk has its own line: ≤ 40 KB gzip (owner, 2026-10-24) |

## Assumptions (correct any of these before I write module specs)

1. You're the only editor, and your GitHub account can push to this repo.
2. Publish commits **directly to `main`**, which triggers a Netlify production deploy. Previewing happens **in the page** before you publish: your edits render live in the real dialog. Branch-and-PR publishing is out of v1.
3. v1 sign-in is a **fine-grained personal access token** (this repo only, Contents read and write). You paste it once, and it's kept in `sessionStorage` until the tab closes. A "Sign in with GitHub" OAuth flow (a small Netlify Function) can follow later.
4. v1 editing scope is **projects**: every field in the project dialog, the gallery, and the card settings (size, treatment, theme, motif, layout). Résumé, hero, and era editing come in v2.
5. Invalid content can't go live. The editor validates before committing, and the build validates again and fails on errors, so Netlify keeps the last good deploy.
6. Raw media is committed under `media-src/<slug>/`. The optimized files under `public/media/` become **build output** and stop being committed. This changes the repo layout, and it's a one-time migration.
7. `/admin` isn't linked from the public site, and it's served with `noindex`. Security comes from the GitHub token, not from hiding the URL.

## Resolved questions (owner, 2026-10-24)

| # | Question | Answer |
| --- | --- | --- |
| 1 | Assumptions 1–7 | Accepted as written (map approved without corrections) |
| 2 | Add and delete projects in v1? | **Yes.** v1 creates, edits, and deletes projects |
| 3 | Run sharp in the Netlify build (about 30–60 s more per deploy)? | **Yes**, acceptable |
| 4 | Admin JS budget | **Its own budget line:** ≤ 40 KB gzip for the admin chunk only. The public budgets don't change |

## ID ranges (so module specs don't collide)

| Module | FR ids | Task ids |
| --- | --- | --- |
| `content-json` | FR-300–FR-319 | T300–T319 |
| `media-pipeline` | FR-320–FR-339 | T320–T339 |
| `admin-auth` | FR-340–FR-359 | T340–T359 |
| `github-publish` | FR-360–FR-379 | T360–T379 |
| `edit-layer` | FR-380–FR-399 | T380–T399 |
