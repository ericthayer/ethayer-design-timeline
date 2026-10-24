# Plan 004 · admin-auth

How [spec-admin-auth.md](./spec-admin-auth.md) gets built. Every rule in the [constitution](../constitution.md) applies.

## 1. Components

```
index.html ── main.ts (public, unchanged except the router base check)
               └─ build injects <meta> CSP floor (FR-355)
admin.html ── src/admin/entry.ts ─┬─ provider.ts (patProvider) ── verify.ts, token-store.ts
   (same <body>)                  ├─ session.ts → AdminSession → 'admin:signed-in' on document
                                  ├─ <admin-sign-in> in <main> (page mode) or a <dialog> (re-auth)
                                  ├─ <aside id="admin-island"> ─ <admin-status> + [data-admin-slot="toolbar"]
                                  └─ after sign-in: import('../main.ts') boots the real wall and dialog
netlify.toml  /* header = CSP ceiling · /admin, /admin/* → /admin.html · X-Robots-Tag on admin paths
```

Flow: load `/admin/work/x` → `entry.ts` → `provider.restore()` (or the sign-in panel) → `verifyToken()` (two parallel GETs) → `createSession()` → mount the island → `import('../main.ts')`. `Router` sees the `/admin` base and opens `x` → `admin:signed-in` → `edit-layer` attaches later.

## 2. Decisions (short ADRs)

| # | Decision | Chosen | Rejected and why |
| --- | --- | --- | --- |
| ADR-A1 | Entry | **Separate `admin.html` Vite entry**, booting the unchanged public `main.ts` after sign-in | (a) one `index.html` with a `pathname` check: both paths are one document, so the CSP has to vary by header path. Netlify doesn't document what happens when `/*` and `/admin/*` both set `Content-Security-Policy` (combined into two policies, the intersection blocks GitHub). It also puts an admin `import()` in the public graph |
| ADR-A2 | Per-path CSP | **Header ceiling plus meta floor in `index.html`** | Path-specific header override: depends on undocumented merge behavior. Listing public paths instead of `/*`: any new path silently loses its CSP. Edge Function rewriting headers: new infrastructure for one header |
| ADR-A3 | Admin URLs | **Base prefix `/admin`** on the existing routes | Query flag (`?admin`): lost on every `pushState` the router does. A separate admin router: duplicates FR-060 |
| ADR-A4 | Boot | **Gate the public app behind sign-in** | Boot first and overlay a modal: it stacks with a deep-linked project dialog, and the router syncs before the session exists |
| ADR-A5 | Storage | **`sessionStorage`**, memory fallback | `localStorage`: the token outlives the tab and is shared with every tab. Memory only: every reload (and `edit-layer`'s draft restore) needs a re-paste. Cookies: no server to read them. XSS reads all of these equally, so the defense is CSP plus no `innerHTML` |
| ADR-A6 | Card links | **Keep public `/work/:slug` `href`s** | Base-aware `href`s would touch `anatomy.ts`, outside this module. In-app clicks stay under `/admin` through the router |

## 3. Order

1. **T341** verify V1–V8 (no code). Update the spec first if any fact differs.
2. **T342** CSP ceiling and floor. Existing e2e now runs under the meta CSP, so regressions surface early.
3. **T343** `admin.html`, rewrites, noindex, and an entry stub. **T344** budgets and isolation gate. **T345** router base.
4. **T346** verification, **T347** session and storage (pure, unit tested).
5. **T348** `<admin-sign-in>`, **T349** `<admin-status>`, **T350** boot flow.
6. **T351** e2e and axe. **T352** owner deploy-preview check. **CP4c**.

## 4. External facts to verify (T341)

| # | Fact the spec relies on | Confidence | If wrong |
| --- | --- | --- | --- |
| V1 | `api.github.com` answers CORS preflights with `Authorization` from any origin | High | The architecture fails. Stop and escalate |
| V2 | `GET /repos/{o}/{r}` `permissions.push` reflects the **token's** Contents permission | Medium-low | Open question 3: probe with `POST /git/blobs` |
| V3 | `github-authentication-token-expiration` is readable cross-origin (`Access-Control-Expose-Headers`) | Low | `expiresAt` stays `null`, and `expired` is never produced. The UI shows the static 30-day reminder |
| V4 | `GET /user` works for a fine-grained token with no account permissions | Medium-high | Take `owner.login` from `/repos` |
| V5 | The token page accepts prefill query parameters | Low | Written steps only (already the baseline) |
| V6 | Netlify serves `/admin/*` → `/admin.html` (200), and `X-Robots-Tag` on `/admin*` matches the request path | Medium | The `<meta name="robots">` already covers noindex |
| V7 | `admin.html`'s dynamic import of the index entry chunk brings its CSS; the Vite preview plugin serves `/admin*` | Medium-high | Add `main.ts`'s CSS as a second `<link>` through the plugin |
| V8 | A meta CSP is enforced alongside the header CSP (both policies apply) | High | ADR-A2 fails. Fall back to explicit public paths |

Sources: GitHub REST docs (CORS, the repositories endpoint, rate limits, fine-grained PAT permissions), Netlify docs (headers, redirects, request chain), and CSP Level 3 §4.

### T341 results (2026-10-24)

| # | Result |
| --- | --- |
| V1 | **Confirmed** live: the preflight to `https://api.github.com/user` answers `access-control-allow-origin: *` and allows `Authorization` and `X-GitHub-Api-Version` ([REST CORS docs](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests)) |
| V2 | **TO VERIFY** by the owner with a real read-only token (T352). The docs don't say whether `permissions` reflects the token or the account role. If refuted, open question 3 decides the fix |
| V3 | **Refuted** live: `github-authentication-token-expiration` isn't in `access-control-expose-headers` (which does list `Retry-After` and `X-RateLimit-*`). `expiresAt` is `null` in browsers, and the status shows the static 30-day reminder |
| V4 | **TO VERIFY** by the owner with a real token (T352). The users docs don't list a fine-grained permission for `GET /user` |
| V5 | **Confirmed** ([changelog 2025-08-26](https://github.blog/changelog/2025-08-26-template-urls-for-fine-grained-pats-and-updated-permissions-ui)). Unused until open question 1 is answered, so the link carries no parameters |
| V6 | **Partly confirmed**: 200 rewrites per [Netlify redirects](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/). The [headers docs](https://docs.netlify.com/manage/routing/headers/) don't say whether rules match the request or the rewritten path, so `X-Robots-Tag` is set on `/admin`, `/admin/*`, and `/admin.html`. Owner confirms with `curl -sI` (T352) |
| V7 | Checked in the T343 build. The dynamic import brings the index CSS at boot, but the sign-in page renders before boot, so the plugin also links the index entry's CSS into `admin.html` at build (the fallback), and dev loads the style modules first |
| V8 | **Confirmed**: [CSP3 §8.1](https://www.w3.org/TR/CSP3/#multiple-policies) enforces every policy in the list. A `<meta>` policy can't carry `frame-ancestors` |

## 5. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| The meta floor is missing from a build, so public pages could reach GitHub | `check-budgets` fails if `dist/index.html` lacks the meta. The isolation gate keeps GitHub strings out of public JS. E2E asserts a `securitypolicyviolation` |
| Vite dev injects `<style>` and is blocked by the meta CSP | The floor plugin is `apply: 'build'`. Dev has no CSP, as today |
| `admin.html`'s body drifts from `index.html`'s | A unit test compares the bodies byte for byte |
| Total public JS jumps because admin chunks get counted | Public lines walk the manifest from `index.html` only. Admin gets its own line |
| A token leaks through logs or errors | ESLint `no-console` on auth paths. The error union carries no strings from the token. E2E scans console and URL |
| A 401 mid-edit loses work | No reload on a 401. Re-auth in a dialog. `edit-layer`'s local draft covers a reload anyway |
| Two modal dialogs (project plus re-auth) | Re-auth opens with `showModal()` after the project dialog, so the top layer orders them. Focus returns to the opener on close |
| A stolen tab or session | 30-day expiry, single-repo scope, sessionStorage scoped to the tab, Sign out, and revoking at GitHub (stated in the panel) |

## 6. Checkpoints

- **CP4c** (end of this module): the owner signs in on a deploy preview with a real token, sees a read-only token refused, checks the response headers, and confirms the public site makes no GitHub requests. `github-publish` may start only after CP4c, and `edit-layer` builds on its island and events.
