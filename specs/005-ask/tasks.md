# Tasks 005 · Ask

Legend as in [001 tasks](../001-timeline-wall/tasks.md). A task is done when its Acceptance holds **and** `npm run check` passes. One task per commit, citing its `T4xx`. Spec: [spec.md](./spec.md) · Plan: [plan.md](./plan.md).

Nothing here starts until the owner approves this spec. T400–T403 may run on a branch during the CP4d wait if AQ6 = yes. T404 onward waits for CP4e. Phase 2 also waits for CP5b and amendments A1 and A2.

## Phase 0 · Content (owner)
- [ ] **T399** Owner drafts `about.json` (process, values, how he works, and whatever personal topics he wants answerable) and 8–16 chips with answers. Claude can propose question wording and edit copy, but the facts are Eric's. → FR-410, FR-435

## Pure core
- [ ] **T400** Types and validator rules for `ask.json` and `about.json`, with fixtures. → FR-410, FR-435
  - Acceptance: an unknown or draft `related` slug, a missing follow-up id, a self follow-up, a label over 60 chars, and an about corpus over 12,000 chars each give an error-level issue. · Verify: `npx vitest run tests/unit/ask/content` · Files: `src/content/ask.ts`, `src/content/validate/ask.ts`, `tests/unit/ask/content.test.ts`
- [ ] **T401** `buildCorpus(bundle)`. → FR-430
  - Acceptance: drafts are absent, two runs give byte-identical output, and key order in the source JSON doesn't change the output. · Verify: `npx vitest run tests/unit/ask/corpus` · Files: `src/core/ask/corpus.ts`, `tests/unit/ask/corpus.test.ts`
- [ ] **T402** `render.ts` segment parser. → FR-432
  - Acceptance: `[[dmns]]` → project ref, `[[nope]]` → dropped, `[[link:Email]]` → the site link, a bare `https://…`, `<b>`, `![x](y)`, and `[a](b)` stay inert text, and a half token at the end is dropped. · Verify: `npx vitest run tests/unit/ask/render` · Files: `src/core/ask/render.ts`, `tests/unit/ask/render.test.ts`
- [ ] **T403** `protocol.ts` and `history.ts`: request validation and caps, the event union, the incremental NDJSON decoder (split chunks, multi-byte UTF-8 across chunks), and history trimming. → FR-417, FR-418, FR-436
  - Acceptance: an oversize body, a seventh turn, a non-string field, and an unknown event type are all rejected, and a decoder fed one byte at a time yields the same events. · Verify: `npx vitest run tests/unit/ask/protocol` · Files: `src/core/ask/protocol.ts`, `src/core/ask/history.ts`, `tests/unit/ask/protocol.test.ts`

## Phase 1 · Ask, static (after CP4e)
- [ ] **T404** Budget baseline: record initial JS, total JS, and CSS today, and add an `ask` chunk gate (≤ 8 KB JS, ≤ 2 KB CSS gzip) to `check-budgets`. → spec §9
  - Acceptance: numbers recorded in the PR. The gate fails a fixture over the limit. · Verify: `npm run build && npm run budgets` · Files: `scripts/check-budgets.ts`, `vite.config.ts`
- [ ] **T405** `/ask` route, Netlify rewrite, and the header item. → FR-400, FR-401
  - Acceptance: `/ask` deep link opens the dialog. Close restores the URL, title, and focus. Without JS, the link lands on the static page (T409). · Verify: `npx vitest run tests/unit/router` · Files: `src/core/router.ts`, `src/main.ts`, `index.html`, `netlify.toml`
- [ ] **T406** `<ask-dialog>` shell: lazy import, modal, heading, notice slot, Esc and focus rules. → FR-402, FR-403, FR-422
  - Acceptance: no new tokens in the CSS (a test scans for raw colors and sizes). Focus returns to the opener. · Verify: `npm run check` · Files: `src/components/ask-dialog/ask-dialog.ts`, `ask-dialog.css`, `src/index.ts`
- [ ] **T407** `ask-log.ts`: turns, labels, `aria-busy`, the status region, and the auto-scroll rule. → FR-420, FR-421, FR-423
  - Acceptance: one status announcement per answer. Auto-scroll never moves focus. · Verify: `npm run check` · Files: `src/components/ask-dialog/ask-log.ts`
- [ ] **T408** `ask-chips.ts`: chip list, follow-ups, Open buttons, and opening a project from an answer. → FR-411, FR-412, FR-433
  - Acceptance: a chip makes no network request. Open routes to `/work/<slug>`, and closing that returns to `/ask` with the log intact. · Verify: `npm run check` · Files: `src/components/ask-dialog/ask-chips.ts`
- [ ] **CP5a** Owner reviews the header item and the dialog on a deploy preview at 390, 1280, and 1920 px, and answers AQ5 and AQ9.
- [ ] **T409** Static `/ask` page from `ask.json`, with the privacy note. → US-A5, FR-440
  - Acceptance: works with JS off, zero axe violations, and it is in the sitemap. · Verify: `npx playwright test tests/e2e/ask-static.spec.ts` · Files: `scripts/ask-prerender.ts`, `tests/e2e/ask-static.spec.ts`
- [ ] **T410** E2E and axe for Phase 1: open by click and deep link, chip, follow-up, Open and back, Esc, keyboard only. → US-A1, US-A4
  - Acceptance: zero axe violations on every Phase 1 state. · Verify: `npx playwright test tests/e2e/ask.spec.ts` · Files: `tests/e2e/ask.spec.ts`
- [ ] **CP5b** Phase 1 ships to production (chips only).

## Phase 2 · Ask, Claude (after CP5b, A1, A2)
- [ ] **T420** Function skeleton: `config.path`, `GET` probe, `ASK_ENABLED`, Origin check, body validation through `protocol.ts`, `config.rateLimit`, and a lint rule that keeps the SDK and `netlify/functions/**` out of `src/**`. → FR-436, FR-439, FR-445, FR-448
  - Acceptance: the rate-limit rule shows in the deploy log. A disabled switch gives `{ enabled: false }` and 503. · Verify: `npm run check`, then the deploy log · Files: `netlify/functions/ask.ts`, `eslint.config.js`, `package.json`
- [ ] **T421** Prompt assembly and the model call (`messages.stream`, cache block, effort, fallbacks, stop-reason mapping). → FR-431, FR-437, FR-447
  - Acceptance: a unit test with a stubbed client asserts the request body (model, `output_config`, no sampling params, cache_control on the corpus block only) and maps `refusal` → `declined`, `max_tokens` → `truncated`. · Verify: `npx vitest run tests/unit/ask/function` · Files: `netlify/functions/ask/prompt.ts`, `netlify/functions/ask.ts`, `tests/unit/ask/function.test.ts`
- [ ] **T422** HMAC signing and history verification. → FR-438
  - Acceptance: a tampered or unsigned assistant turn is dropped, and chip turns verify against `ask.json`. · Verify: `npx vitest run tests/unit/ask/sign` · Files: `netlify/functions/ask/sign.ts`, `tests/unit/ask/sign.test.ts`
- [ ] **T423** Logging per FR-441 only. → FR-441
  - Acceptance: a test asserts no question or answer text reaches the logger. · Verify: `npx vitest run tests/unit/ask/function` · Files: `netlify/functions/ask.ts`
- [ ] **T424** `ask-composer.ts`: form, count, Enter and Shift+Enter, probe, fetch, decode, Stop, the 45 s timeout. → FR-415–FR-419
  - Acceptance: Stop keeps the partial answer marked "Stopped". Focus stays in the textarea. · Verify: `npm run check` · Files: `src/components/ask-dialog/ask-composer.ts`
- [ ] **T425** Error and degradation copy for every `AskEvent` error code, 429, and the probe. → FR-416, FR-445, FR-446, US-A5
  - Acceptance: a `Record<AskErrorCode, string>` forces full coverage, and `over-budget` hides the composer for the session. · Verify: `npm run check` · Files: `src/core/ask/copy.ts`, `tests/unit/ask/copy.test.ts`
- [ ] **T426** E2E with a mocked `/api/ask` (Playwright route): stream, Open from an answer, Stop, each error, AI off, and axe on every state. → US-A2–US-A5
  - Acceptance: zero axe violations. One status announcement per answer. · Verify: `npx playwright test tests/e2e/ask-ai.spec.ts` · Files: `tests/e2e/ask-ai.spec.ts`, `tests/e2e/ask-mock.ts`
- [ ] **T427** Ops: a dedicated workspace and key (owner), Netlify env vars, the spend limit, and a deploy-preview check that `cache_read_input_tokens` is non-zero on a second question. → FR-439, FR-446, §6
  - Acceptance: noted in the PR, with no secret in the repo. · Verify: the owner · Files: none
- [ ] **T428** Eval harness and cases; run on a deploy preview for Opus 5.5 and Haiku 5.5 when the owner asks. → plan §5
  - Acceptance: the scripted pass rules hold, and transcripts are attached to the PR. · Verify: `node scripts/ask-eval.ts --target <preview-url>` · Files: `scripts/ask-eval.ts`, `tests/ask-eval/cases.json`
- [ ] **CP5c** Owner approves A1 and A2, sets the spend limit (AQ2), picks the model (AQ1), and turns on `ASK_ENABLED` in production.

## Phase 3 · WebMCP (optional, after CP5c)
- [ ] **T430** Feature-detected lazy import and `registerTool` for the five tools. → FR-450, FR-451
  - Acceptance: with no `document.modelContext`, no tools chunk is requested. · Verify: `npm run build && npm run budgets` · Files: `src/webmcp/tools.ts`, `src/main.ts`
- [ ] **T431** Unit tests for tool handlers (schema validation, unknown slug, drafts hidden) against a fake `modelContext`. → FR-451
  - Acceptance: every tool has a test, and `open_project` only routes to known slugs. · Verify: `npx vitest run tests/unit/webmcp` · Files: `tests/unit/webmcp/tools.test.ts`
- [ ] **T432** Origin-trial header (if AQ8 = yes) and a manual check with the Model Context Tool Inspector. → FR-452
  - Acceptance: noted in the PR. · Verify: the owner · Files: `netlify.toml`
- [ ] **CP5d** Owner tries the tools and decides whether to keep them on.
