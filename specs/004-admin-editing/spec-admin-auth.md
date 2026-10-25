# Spec 004 · admin-auth: the `/admin` entry, GitHub sign-in, and admin CSP

| Field | Value |
| --- | --- |
| Status | **Draft (2026-10-24)**: from the approved [capability map](./capability-map.md). Awaiting CP4c |
| Owner | Eric Thayer |
| Companions | [plan-admin-auth.md](./plan-admin-auth.md) · [tasks-admin-auth.md](./tasks-admin-auth.md) · [constitution](../constitution.md) |
| Consumers | `github-publish` (calls `authorizedFetch`), `edit-layer` (mounts into the admin island) |

## 1. Objective

Give the owner, the only editor, a way into an editing mode of the **real** site at `/admin`, signed in with a fine-grained GitHub token. Public visitors must not download a byte of admin code or contact GitHub. Security comes from the token, not from hiding the URL (map assumption 7).

**Decisions** (the plan has the reasoning): (1) a **separate Vite HTML entry, `admin.html`**, served at `/admin` and `/admin/*`, that boots the unchanged public app after sign-in; (2) admin URLs are the public routes under a `/admin` base; (3) the token lives in `sessionStorage`, with an in-memory fallback; (4) the CSP uses a **header ceiling plus a public meta floor**, so only `admin.html` may reach `https://api.github.com`. External facts this spec relies on are tagged V1–V8 and listed, with confidence, in the plan's §4. Each must be verified in T341.

### User stories

**US-A1 (P1). Sign in with a token.** **Given** `/admin` with no session, **then** the page shows the site header and a sign-in panel with steps for creating the token and a link to GitHub. **When** the owner pastes a valid token and activates Verify, **then** the panel says "Checking with GitHub…", the wall boots, and the status reads "Signed in as ericthayer". **When** the token is wrong, **then** a specific, actionable error names the fix (§3, FR-348), and focus returns to the field.

**US-A2 (P1). Stay signed in for the tab.** **When** the owner reloads, **then** the stored token is re-verified and the site boots without pasting again. **When** the tab closes, **then** the token is gone.

**US-A3 (P1). Sign out.** **When** the owner activates Sign out, **then** the token is erased from storage and memory, and `/admin` reloads to the sign-in panel.

**US-A4 (P1). Public visitors are unaffected.** **Given** `/`, `/work/:slug`, or `/resume`, **then** no request goes to `api.github.com`, no admin chunk loads, and the effective CSP is today's.

**US-A5 (P2). The token stops working mid-session.** **When** any GitHub call returns 401, **then** the session ends, a sign-in dialog opens over the page without a reload, and signing in again resumes the session.

**US-A6 (P2). Deep links inside admin.** **Given** `/admin/work/<slug>`, **when** sign-in succeeds, **then** that project dialog opens. Prev/Next, Close, and Back keep the `/admin` prefix.

## 2. Tech stack and commands

No new dependencies. Vanilla TS custom elements, Vite multi-page build (`index.html`, `admin.html`), Netlify redirects and headers, and GitHub REST API version `2022-11-28` through `fetch`.

| Command | Use |
| --- | --- |
| `npm run dev`, then open `/admin` | Admin in dev (the Vite rewrite plugin serves `admin.html`) |
| `npm run check` | Typecheck, lint (incl. `no-console` in auth code), unit tests |
| `npm run build && npm run budgets` | Public and admin budget lines, plus the isolation gate (FR-341) |
| `npm run e2e` | Playwright with GitHub mocked by route interception |
| `curl -sI https://<deploy>/admin` | Manual: check `Content-Security-Policy` and `X-Robots-Tag` on a deploy preview |

## 3. Functional requirements

### Entry and routing
- **FR-340** `admin.html` is a second Vite entry. Its `<body>` is byte-identical to `index.html`'s `<body>` (a unit test guards drift). Its head differs only by title "Admin — Eric Thayer", `<meta name="robots" content="noindex, nofollow">`, and the script `/src/admin/entry.ts`. Netlify rewrites `/admin` and `/admin/*` to `/admin.html` (200). A Vite plugin applies the same rewrite in `dev` and `preview`.
- **FR-341** Isolation: nothing in `index.html`'s static or dynamic import graph imports `src/admin/**`, `src/core/auth/**`, or the admin components. `scripts/check-budgets.ts` reads the Vite manifest and **fails** if any public JS chunk contains the string `api.github.com`.
- **FR-342** Router base: `'/admin'` when the path matches `^/admin(/|$)`, otherwise `''`. Admin routes are `/admin`, `/admin/work/:slug`, and `/admin/resume`. Public behavior and card `href`s (`/work/:slug`) are unchanged. In-app navigation (open, Prev/Next, close, Back, unknown slug reset) stays under the base.
- **FR-343** Gated boot: `entry.ts` imports the public app (`src/main.ts`) with dynamic `import()` only after a verified session. Before that, `<main>` holds only the sign-in panel.
- **FR-344** `/admin`, `/admin/*`, and `/admin.html` are sent with `X-Robots-Tag: noindex, nofollow`. `/admin` isn't linked from the public site, robots.txt, or any sitemap (a robots.txt `Disallow` would hide the noindex and advertise the path).

### Sign-in
- **FR-345** `<admin-sign-in>` is a `<form>` with a heading, ordered steps, a link to `https://github.com/settings/personal-access-tokens/new` (new tab, labeled), a visible `<label>` "GitHub token" on `<input type="password" autocomplete="off" spellcheck="false">`, a "Show token" toggle, a Verify submit button, and a status line. Steps: name "Timeline admin", **expiration 30 days (recommended)**, resource owner `ericthayer`, "Only select repositories" → `ethayer-design-timeline`, Repository permissions → **Contents: Read and write** and **Commit statuses: Read-only** (D1; Metadata: Read-only is added automatically). Verification doesn't check Commit statuses, so a token without it still signs in.
- **FR-346** Pre-check before any request: trim. Empty → `empty`. Not starting with `github_pat_` → `not-fine-grained` (classic `ghp_` tokens are refused).
- **FR-347** Verify sends `GET /user` and `GET /repos/ericthayer/ethayer-design-timeline` in parallel. Precedence: network error → `network`. Either response 429, or 403 with `x-ratelimit-remaining: 0` → `rate-limited` (reset from `x-ratelimit-reset` or `retry-after`). `/user` 401 → `expired` if a stored `expiresAt` has passed, else `bad-token`. `/user` 2xx with a `login` other than `ericthayer` (case-insensitive, D6) → `wrong-account`, and nothing is stored. `/repos` 404 or 403, or `full_name` not matching (case-insensitive) → `wrong-repo`. `/repos` 200 with `permissions.push !== true` → `read-only`. Any other non-2xx → `github-error`. Otherwise `ok`, with `login` and `expiresAt` parsed from `github-authentication-token-expiration` when readable, else `null` (verify V2, V3).
- **FR-348** Each error kind has one message that names the fix, for example `read-only`: "This token can read the repository but not change it. Set Contents to Read and write." `bad-token` says "mistyped, revoked, or expired", because GitHub's 401 doesn't say which. `wrong-account` says the token belongs to another GitHub account and only `ericthayer` can edit this site.

### Session and storage
- **FR-349** Storage: `sessionStorage['timeline:admin-session']` = `{"v":1,"token","login","expiresAt"}`. Every access is wrapped in try/catch (as `core/motion.ts`). If storage throws, the token lives in memory for the tab, and the panel notes "You'll need to paste the token again after a reload." Never `localStorage`, cookies, IndexedDB, or a URL.
- **FR-350** Restore: on load, a stored token is re-verified (FR-347) before boot. On failure it's cleared, and the panel shows the error.
- **FR-351** `AdminSession` (§5) is the only thing consumers see. `authorizedFetch` resolves `path` against `https://api.github.com` and throws `TypeError` unless the resolved origin is exactly that (no absolute, `//`, or `@` paths). It sets `Authorization: Bearer`, `Accept: application/vnd.github+json`, and `X-GitHub-Api-Version: 2022-11-28`, drops any caller `Authorization`, and forces `credentials: 'omit'` and `referrerPolicy: 'no-referrer'` (`cache` defaults to `'no-store'`). It resolves with the `Response` for every HTTP status.
- **FR-352** On a 401, before resolving, the session ends: storage and memory are cleared, `admin:signed-out` fires on `document` with `{ reason: 'unauthorized' }`, later calls on that session reject with `SignedOutError`, and a modal re-auth dialog opens. Esc dismisses it, and the status then offers "Sign in again". A new sign-in fires `admin:signed-in` with a **new** session object.
- **FR-353** Sign out clears storage and memory, fires `admin:signed-out` with `{ reason: 'user' }`, then `location.assign('/admin')` (a full load drops every in-memory reference).
- **FR-354** `entry.ts` appends `<aside id="admin-island" aria-label="Admin">` to `<body>`, holding `<admin-status>` ("Signed in as {login}", expiry text, Sign out) and an empty `<div data-admin-slot="toolbar">` for `edit-layer`. `edit-layer` may re-parent the island (into an open modal dialog, so it isn't inert). `<admin-status>` makes no assumptions about where it sits.
- **FR-355** CSP. The `/*` header becomes the **ceiling**: today's policy plus `https://api.github.com` in `connect-src` and `blob:` in `img-src` (upload previews). The build injects a `<meta http-equiv="Content-Security-Policy">` **floor** into `index.html` only: today's policy without `frame-ancestors` (which meta can't carry, and the header keeps). Browsers enforce both policies, so public pages keep `connect-src 'self'` and `img-src 'self'`. `scripts/csp.ts` is the single source, and a unit test checks `netlify.toml` against it.
- **FR-356** Token hygiene: no `console.*` in `src/admin/**`, `src/core/auth/**`, or the admin components (ESLint error). The token never appears in URLs, history state, error messages, event details, or the DOM after success (the field is cleared). Only `verify.ts` and `authorizedFetch` send it, and only to `https://api.github.com`.
- **FR-357** Accessibility: the page-mode panel uses `<h1>`, the re-auth dialog a labeled `<h2>` in a native `<dialog>`. Errors set `aria-invalid` and join the field's `aria-describedby`, and focus returns to the field. Progress and outcomes are announced in a `role="status"` region. Verify stays focusable while busy (`aria-disabled`, repeat submits ignored). The toggle uses `aria-pressed`. After sign-in, focus moves to `<main>`. The island reserves `scroll-padding-block-end` so focus is never hidden under it (SC 2.4.11). Targets are ≥ 24 px (SC 2.5.8).
- **FR-358** Budgets: a new **Admin JS** line (chunks reachable from `admin.html` minus the public set) ≤ 40 KB gzip, with admin-auth's own share targeted at ≤ 6 KB. Public lines measure the public graph only. Public initial JS grows by ≤ 0.3 KB gzip against `6240560` (the router base check). An **Admin CSS** line (CSS reachable from `admin.html` minus the public set) is gated at ≤ 5 KB gzip (D7).
- **FR-359** `AuthProvider` seam: `entry.ts` talks to an `AuthProvider` (`restore`, `signIn`, `signOut`), not to tokens. v1 ships `patProvider`. A future OAuth provider (§9) replaces it without changing `AdminSession` or its consumers.

## 4. Project structure

```
admin.html                       second Vite entry (FR-340)
src/admin/entry.ts               gated boot, island, provider wiring (FR-343, FR-354)
src/core/auth/config.ts          REPO, API origin, token URL, recommended expiry
src/core/auth/verify.ts          pre-check and verification, fetch injected (FR-346, FR-347)
src/core/auth/messages.ts        error kind → message (FR-348)
src/core/auth/token-store.ts     sessionStorage with memory fallback (FR-349)
src/core/auth/session.ts         AdminSession, authorizedFetch, events (FR-351–FR-353)
src/core/auth/provider.ts        AuthProvider, patProvider (FR-359)
src/components/admin-sign-in/    form, page and dialog modes (FR-345, FR-357)
src/components/admin-status/     "Signed in as", Sign out, re-auth (FR-352, FR-354)
scripts/csp.ts                   CSP directives, the single source (FR-355)
```

## 5. Code style: the consumer contract

```ts
export interface AdminSession {
  readonly login: string;
  readonly repo: { readonly owner: string; readonly name: string; readonly branch: 'main' };
  readonly expiresAt: Date | null; // null when GitHub doesn't expose the expiry header
  /** `path` is relative to https://api.github.com, e.g. `/repos/o/r/git/refs/heads/main`. */
  authorizedFetch(path: `/${string}`, init?: RequestInit): Promise<Response>;
}
export type AuthErrorKind = 'empty' | 'not-fine-grained' | 'bad-token' | 'expired'
  | 'wrong-account' | 'wrong-repo' | 'read-only' | 'rate-limited' | 'network' | 'github-error';
declare global {
  interface DocumentEventMap {
    'admin:signed-in': CustomEvent<AdminSession>;
    'admin:signed-out': CustomEvent<{ readonly reason: 'user' | 'unauthorized' }>;
  }
}
```

## 6. Testing strategy

- **Unit** (fetch, storage, and clock injected): every FR-347 row, including precedence and `expiresAt` parsing; FR-346 pre-check; `authorizedFetch` headers, origin guard, and 401 path (store cleared, event fired, `SignedOutError` afterwards); storage that throws; router base; `admin.html` body drift; CSP header and meta parity.
- **E2E**: public `/`, `/work/<slug>`, and `/resume` make no `api.github.com` request and load no `admin` chunk, and a `fetch` to GitHub from a public page raises a `securitypolicyviolation`. On `/admin`, mocked GitHub responses cover success, each error kind, reload restore, sign-out, a deep link, and Authorization only on `api.github.com`. The token never appears in `page.url()` or console output. axe has zero violations on the empty, error, re-auth, and signed-in states.
- **Manual** (deploy preview, T352): response headers, one real token, one read-only token.

## 7. Boundaries

- **Always**: verify before boot; send the token only through `verify.ts` and `authorizedFetch`; keep `admin.html`'s body identical to `index.html`'s; take CSP from `scripts/csp.ts`.
- **Ask first**: any new CSP source (for example `media-src blob:` for `edit-layer`); widening the token permissions; changes to public `main.ts` beyond the router base; Trusted Types.
- **Never**: import admin code from public code; log, persist outside `sessionStorage`, or put the token in a URL; use `innerHTML`, cookies, or third-party scripts; link `/admin` publicly.

## 8. Success criteria and open questions

1. Every US-A acceptance check passes in e2e, with zero axe violations on `/admin` states. 2. `npm run budgets` shows Admin JS ≤ 40 KB, and public lines and initial JS within FR-358. 3. Deploy-preview headers match FR-344 and FR-355. 4. A read-only token and a token for the wrong repo are refused with their messages.

**Open questions for the owner** (2, 4, and 6 are answered by D7, D6, and D1 in the capability map)
1. If GitHub supports prefilled token-creation URLs (V5), may the link prefill name, repo, expiry, and Contents permission?
2. Should admin-only CSS get its own gated line (≤ 5 KB gzip), or stay report-only?
3. If V2 shows that `permissions.push` reflects your account role instead of the token, may sign-in confirm write access with a harmless probe (`POST /git/blobs`, an unreferenced blob)?
4. Should `/admin` also check that `login === 'ericthayer'`? (It isn't a security boundary, since anyone with push could commit directly.)
5. Enforce Trusted Types (`require-trusted-types-for 'script'`) site-wide after a report-only trial?
6. `github-publish` (its open question 1) needs **Commit statuses: Read-only** to report deploys. If you approve that, FR-345's steps add it. Verification won't require it, so a token without it still signs in, and the deploy status just reads `unknown`.

## 9. Future: OAuth ("Sign in with GitHub")

A later `oauthProvider` implements `AuthProvider`: a GitHub App user-to-server flow with PKCE and `state`, with the code exchanged by a Netlify Function (`/.netlify/functions/github-oauth`, client secret in a Netlify env var). This needs `connect-src 'self'` only, which the ceiling already allows. Short-lived user tokens (8 h, with refresh through the Function) are kept as in FR-349. `AdminSession`, its events, and every consumer stay unchanged. This would get its own spec. Not in v1.

## Implementation notes

- **2026-10-24, owner test with real tokens: V2 refuted.** A read-only fine-grained token signed in, because `permissions.push` reflects the account's role, not the token. FR-347 now ends with a **write check**: `POST /repos/{o}/{r}/git/blobs` with fixed content (`WRITE_PROBE`, the same blob every time, never referenced by a commit). 403 or 404 → `read-only`, a rate limit → `rate-limited`, a thrown request → `network`, any other non-2xx → `github-error`. It runs only after every read check passes.
- **2026-10-24, owner bug: Sign out did nothing in the project or résumé view.** A modal `<dialog>` makes the rest of the page inert, island included. `followModals()` (admin-status.ts) keeps `#admin-island` inside the open modal (skipping dialogs inside the island) and returns it to `<body>` on close. The modal gets the same bottom padding as `<body>`. The e2e test now signs out with the dialog open.

- T341: V3 is refuted (plan §4 results), so `expiresAt` is `null` in browsers, `expired` is never produced, and the status shows the static 30-day reminder. The header parser stays for the day GitHub exposes it.
- T341: V2 and V4 need a real token and are TO VERIFY by the owner in T352. If V2 is refuted, a read-only token passes verification until open question 3 is decided.
- FR-340, FR-343, FR-358 (T343): in one Rolldown build, any module both entries share (`core/dom.ts`, the preload helper) is split into new **public** chunks (measured +648 B public initial JS, three entry scripts). So `admin.html` is built as its own graph by a Vite plugin right after the public build (manifest `dist/.vite/admin-manifest.json`), and `entry.ts` boots the **built** public entry by URL (`<link rel="modulepreload" data-public-entry>`, which the plugin adds with the entry's CSS) instead of `import('../main.ts')`. Public output stays byte-identical. Consequence for `edit-layer`: public modules it imports are copies, not the running app's instances, so it talks to the app through the DOM and events.
- FR-347 precedence with D6: network → rate-limited → `/user` 401 → `wrong-account` → `wrong-repo` → `read-only` → `github-error` → `ok`.
- FR-351: `@` is allowed inside a `/`-rooted path (for example `photo@2x.png`), since it can't change the origin there. Absolute, `//`, `/\`, and userinfo inputs are rejected by the origin and credential check.
- FR-351: `Accept` defaults to `application/vnd.github+json` only when the caller didn't set one, so `github-publish` can request a raw media type.
