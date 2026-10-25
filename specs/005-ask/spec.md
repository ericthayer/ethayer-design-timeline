# Spec 005 · Ask: questions about Eric, answered from the site's own content

| Field | Value |
| --- | --- |
| Status | **Draft (2026-10-25)**: plan only, from the owner's request. Awaiting owner review of this spec and the amendments in §9 |
| Owner | Eric Thayer |
| Companions | [plan.md](./plan.md) · [tasks.md](./tasks.md) · [002 spec](../002-hero-and-resume/spec.md) (résumé dialog, `/resume` route) · [004 spec-content-json](../004-admin-editing/spec-content-json.md) (validator) · [constitution](../constitution.md) |
| Sequencing | After 004 `edit-layer` (CP4e) for anything visible. Phase 0 content and the pure core (T400–T403) may run earlier (§10, AQ6) |

## 1. Objective

The owner, verbatim: "the bento board may be too busy for some people and instead of creating more call to actions or information sections, we could allow the user to prompt for the information or click on suggestions that provide them information about me, my process, my experience, or anything else pertaining to me as someone may want to know about me professionally or personally."

So: one quiet entry point, **Ask**, opens a full-screen dialog in the existing résumé-dialog visual language. The visitor either taps a **suggestion chip** (a curated question with an answer Eric wrote) or types a question. Typed questions are answered by Claude through a same-origin Netlify Function, **only** from the site's content JSON plus an "about Eric" corpus Eric writes. Answers link to real project dialogs. When the AI is off, over budget, or unreachable, the chips still work, so the feature never breaks.

### Premise check (read before approving)
- **Ask does not make the wall less busy.** It adds a second path for visitors who arrive with a question ("Has he run a design system?", "How does he work with engineers?"). If the wall itself reads as too busy, that is a design problem for the wall, and it stays locked (constitution I). This spec doesn't touch it.
- **Most of the value is in the chips, not the model.** Ten good questions with answers Eric wrote cover what recruiters and hiring managers ask. They cost nothing, can't hallucinate, and ship in Phase 1 with no API key. The model only covers the long tail.
- **A chatbot on a portfolio is also a liability.** Anything it says reads as Eric's words. That is why grounding (§4), output rules (FR-431), and an eval gate before launch (CP5c) are requirements, not polish.

### User stories
- **US-A1 (P1). Tap a suggestion.** **Given** the home page, **when** a visitor activates Ask and then the chip "How does Eric run a design system?", **then** Eric's written answer appears at once with links to the related project dialogs, with no network request.
- **US-A2 (P1). Ask in your own words.** **Given** the Ask dialog with AI enabled, **when** a visitor types "Has he worked with Angular?" and submits, **then** an answer streams in, states only facts that are in the corpus, and offers "Open: HS Vue Library"-style buttons that open the real project dialogs.
- **US-A3 (P1). Unknown is fine.** **When** a visitor asks something the corpus doesn't cover ("What's his salary range?"), **then** the answer says it doesn't know and points to email, and invents nothing.
- **US-A4 (P1). Screen reader and keyboard.** A keyboard-only visitor can open Ask, pick a chip, type, submit, stop a stream, and close, with focus never lost or hidden. A screen-reader user hears one announcement per answer, not one per chunk.
- **US-A5 (P2). Graceful degradation.** With the function disabled, rate-limited, or over the monthly cap, the input is replaced by a one-line notice and the chips keep working. Without JavaScript, `/ask` serves a static page of the same questions and answers.
- **US-A6 (P3). Bring your own agent.** In a browser with WebMCP, a visitor's agent can call read-only tools (`list_projects`, `get_project`, `get_about`, `get_resume`) and `open_project`, which costs Eric nothing per call.

## 2. Architecture decision

**Recommended: chips first, a server-side Claude proxy second, WebMCP as an additive third. Reject bring-your-own-key.**

| Option | Verdict | Velocity | Risk | Ongoing cost | Notes |
| --- | --- | --- | --- | --- | --- |
| **Static chips** (curated Q&A, no AI) | **Phase 1** | High: content plus one dialog | None: Eric's words only | $0 | Also the fallback and the no-JS `/ask` page |
| **Netlify Function proxy → Claude API** | **Phase 2** | Medium: one function, one stream protocol | Hallucination, abuse, injection, all bounded by §4–§6 | ≈ $0.02 per answer on Claude Opus 5.5 (§7) | Key stays server-side. Same origin, so CSP is unchanged |
| **WebMCP** (`document.modelContext`) | **Phase 3, optional** | High: ≈ 1.5 KB of lazy tool glue | Low: read-only tools over public data | $0 (the visitor's agent pays) | Draft spec and Chrome origin trial only (§8). Almost no visitor has an agent calling it today. It's on-brand for "agentic engineering", not a replacement for Phase 2 |
| **Bring your own key** | **Rejected** | — | Visitors pasting secrets into a portfolio, plus the key would sit in page memory next to third-party iframes | — | No recruiter has a key, or would paste one. It also needs `connect-src https://api.anthropic.com` on the public CSP |

## 3. Functional requirements

### Entry point and dialog
- **FR-400** Entry. One new item, **Ask**, in the header's Contact nav, styled exactly like the existing links (no new color, size, or weight). It is a real link to `/ask`. With JS, the router intercepts it and opens the dialog, like `/resume` (002 FR-122). This is the only change to a locked surface and needs owner approval at **CP5a** (constitution I.1).
- **FR-401** Route. `/ask` is a router route (pattern as `RESUME` in `src/core/router.ts`) and a Netlify rewrite. Closing restores the previous URL, title, and focus on the opener. Deep links open the dialog.
- **FR-402** Dialog. `<ask-dialog>` is a lazy-loaded, full-screen native modal `<dialog>` that reuses the résumé dialog's bar, type scale, spacing, and theme tokens. It introduces **no new tokens**. It is labeled by a visible `<h2>` ("Ask about Eric").
- **FR-403** Layout inside the dialog, top to bottom: a one-line notice (FR-440), the conversation log (FR-420), the chip row (FR-410), and the composer (FR-415). The composer stays visible. When it is sticky, the log gets `scroll-padding-block-end` equal to its height so focused content is never hidden under it (SC 2.4.11).

### Suggestion chips (Phase 1)
- **FR-410** Content. `src/content/data/ask.json` holds 8–16 chips: `{ id, label, topic: 'work' | 'process' | 'experience' | 'personal', answer: string[] (paragraphs), related: slug[], followups: id[] }`. The shared validator checks it: unique kebab ids, labels ≤ 60 chars, paragraphs ≤ 600 chars, every `related` slug exists and is not a draft, every `followups` id exists, no cycles of length 1.
- **FR-411** Chips are `<button>`s in a `<ul>` labeled "Suggested questions". Activating one appends the question and Eric's answer to the log with no network request. The answer's related slugs render as "Open: <project title>" buttons (FR-432). Then the row shows that chip's `followups`, or the top-level set when there are none.
- **FR-412** The chip row starts with one chip per topic, then the rest. Order comes from `ask.json`, never from the model.

### Composer and free-text questions (Phase 2)
- **FR-415** Composer. A `<form>` with a labeled `<textarea>` ("Your question", ≤ 500 chars, live count in `aria-describedby`), a Send button, and a Stop button that is shown only while streaming. Enter sends, Shift+Enter adds a line. Empty or whitespace-only input is refused on the field.
- **FR-416** Capability probe. On first open, the dialog calls `GET /api/ask` once. `{ enabled: false }`, any non-200, or a network error hides the composer and shows "Typed questions are off right now. The suggestions below still work." The probe result is cached for the dialog's lifetime.
- **FR-417** Request. `POST /api/ask` with `{ v: 1, question, history }`. `history` is at most the last 6 turns, each `{ role: 'user' | 'assistant', text, sig? }`. Chip turns are sent as plain user and assistant turns too, so follow-ups have context. Nothing is persisted on the client beyond the dialog's memory: no `localStorage`, no IndexedDB.
- **FR-418** Stream protocol. The response is `application/x-ndjson`, one event per line, a discriminated union shared by client and function (`src/core/ask/protocol.ts`): `{ type: 'text', text }`, `{ type: 'end', reason: 'complete' | 'truncated', sig }`, `{ type: 'error', code: 'invalid' | 'rate-limited' | 'unavailable' | 'over-budget' | 'declined' }`. The client reads it with `fetch` and a `ReadableStream` reader. No `EventSource`, no dependency.
- **FR-419** Stop. Stop aborts the fetch (`AbortController`). The partial answer stays in the log, marked "Stopped".

### Conversation log and streaming accessibility
- **FR-420** The log is a `<section role="log" aria-labelledby>` holding one `<article>` per turn. Visitor turns are labeled "You asked", answers "Answer". AI answers also carry "Answered by Claude from Eric's site", and chip answers carry "Written by Eric".
- **FR-421** Announcing. While an answer streams, its `<article>` has `aria-busy="true"` and the log is **not** a live region. A separate visually hidden `role="status"` region says "Answering…" once, then "Answer ready" or the error copy once. When the stream ends, `aria-busy` is removed. Screen readers then get one complete announcement instead of a word-by-word flood. Chip answers announce "Answer ready" the same way.
- **FR-422** Focus. After Send, focus stays in the textarea. After a chip, focus stays on the chip row (the first new follow-up chip). "Open" buttons are in tab order. Esc closes the dialog unless a stream is running, where the first Esc stops the stream. Focus returns to the opener on close.
- **FR-423** Motion. There is no typing animation or caret. With reduced motion or the global motion pause (constitution IV.4), text still streams, because streaming is content arriving, not decoration. Auto-scroll follows new text only while the visitor is already at the bottom of the log, and never moves focus.

### Grounding and output rules
- **FR-430** Corpus. The function answers only from a corpus built deterministically from: `site.json`, `resume.json`, `eras.json`, every **non-draft** project (title, client, era, role, period, summary, body, tracklist, link labels), `ask.json`, and the new `about.json` (FR-435). Drafts are excluded, because they are `noindex` and unfinished. The corpus is plain text with stable ordering and no timestamps, so the prompt cache prefix stays byte-identical between deploys that don't change content.
- **FR-431** Output rules (system prompt, plan §3): answer in third person, about Eric only, ≤ 120 words unless asked for more, from the corpus only. When the corpus doesn't say, reply that it doesn't know and suggest email. Never infer dates, employers, numbers, salary, availability, or personal details. Refer to projects only with `[[slug]]` tokens and to contact links only with `[[link:<label>]]` tokens. Decline off-topic tasks (writing code, general chat, other people) in one sentence and point back to the chips.
- **FR-432** Rendering. Model output is untrusted text. The client renders it with `textContent` only. A pure parser (`src/core/ask/render.ts`) turns it into segments: paragraphs (blank line), list items (`- `), plain text, `[[slug]]` → an "Open: <title>" button if the slug is a known, non-draft project (else the token is dropped), and `[[link:<label>]]` → the matching link from `site.json` (else dropped). **No URL, markdown, or HTML from the model is ever rendered.** That closes the link-exfiltration and phishing paths.
- **FR-433** Opening a project from an answer closes the Ask dialog and routes to `/work/<slug>`. Closing that project dialog returns to `/ask` with the log intact for the rest of the page session.
- **FR-435** About corpus. `src/content/data/about.json`: `{ sections: [{ id, topic, title, text }] }`. Eric writes it, and its content defines the "personal" scope: if it isn't in `about.json`, the assistant doesn't know it. The validator caps it at 12,000 characters so the whole corpus stays small enough to send in full (no retrieval needed).

### Server function (Phase 2)
- **FR-436** `netlify/functions/ask.ts`, mounted at `/api/ask` through its exported `config.path`. `GET` returns `{ enabled }`. `POST` validates the body (FR-417 shape, ≤ 8 KB, UTF-8, caps per turn: user ≤ 500 chars, assistant ≤ 2,000), checks `Origin` against the site's own origins, builds the request server-side, and streams FR-418 events. The client never sends a system prompt, model, or parameter.
- **FR-437** Model call (verified against the Claude API docs on 2026-10-25): the official `@anthropic-ai/sdk`, `messages.stream`, model `claude-opus-5-5` (AQ1), `output_config: { effort: 'low' }`, thinking left at its adaptive default (it can't be disabled on this model), `max_tokens: 2048`, and no sampling parameters (they return a 400 since 2026-10-21). The system prompt is two blocks, rules then corpus, with `cache_control: { type: 'ephemeral' }` on the corpus block. Server-side refusal fallback is on (`fallbacks: 'default'`, beta `server-side-fallback-2026-07-01`). `stop_reason: 'refusal'` maps to `error: declined`, and `max_tokens` maps to `end: truncated`.
- **FR-438** Signed history. Each `end` event carries `sig = HMAC-SHA256(ASK_SIGNING_KEY, text)` (`node:crypto`). The function drops any assistant turn in `history` whose `sig` doesn't verify, so a client can't forge "previous answers" to steer the model. Chip answers are verified against `ask.json` instead.
- **FR-439** Secrets and switches, as Netlify environment variables: `ANTHROPIC_API_KEY` (a key in a dedicated workspace, §6), `ASK_SIGNING_KEY`, and `ASK_ENABLED` (`'true'` to serve; anything else makes `GET` return `{ enabled: false }` and `POST` return 503). None is ever exposed to the client or the build output.

### Privacy and disclosure
- **FR-440** Notice. Above the composer: "Typed questions are answered by Claude (Anthropic) from this site's content. Answers can be wrong. Don't include personal information." It links to a short privacy note on the static `/ask` page.
- **FR-441** Logging. The function logs only: timestamp, outcome (`complete | truncated | declined | error code`), input, output, and cache token counts, and latency. **No question text, no answer text, no IP, and no history** are logged or stored by this site (AQ3). Anthropic's API retention applies to the request itself, and the privacy note says so.
- **FR-442** No third-party request leaves the browser. The only new browser request is same-origin `/api/ask`, so `connect-src 'self'` is unchanged.

### Abuse and cost controls
- **FR-445** Rate limits, as code-based Netlify rules in the function's `config.rateLimit` (available on every plan; rules can't be set in `netlify.toml` for functions): **8 requests per 60 s per IP and domain** (`aggregateBy: ['ip', 'domain']`). Over the limit, Netlify returns 429, which the client maps to "You're asking quickly. Try again in a minute." Netlify notes enforcement can lag about 10 s.
- **FR-446** Hard spend cap: a **monthly spend limit on a dedicated Anthropic workspace** set in the Claude Console (AQ2, default $20). When it is hit, the API errors until the 1st of next month, and the function maps that to `over-budget`, after which the client hides the composer for the session.
- **FR-447** Per-request bounds: FR-436 input caps, ≤ 6 history turns, `max_tokens` 2048, one model call per request (no tools, no loops). The worst case per request is about 2.1 K output tokens plus a ≈ 15 K token prefix.
- **FR-448** Kill switch: `ASK_ENABLED=false` takes effect on the next request without a deploy (Netlify env vars are read at invocation).

### WebMCP (Phase 3)
- **FR-450** Feature detection. Only when `'modelContext' in document` does main dynamically import `src/webmcp/tools.ts`. Otherwise no bytes load. `navigator.modelContext` (the pre-Chrome-150 name) is not used.
- **FR-451** Tools registered with `document.modelContext.registerTool`: `list_projects({ era?, topic? })`, `get_project({ slug })`, `get_resume()`, `get_about({ topic? })` (all `annotations.readOnlyHint: true`), and `open_project({ slug })`, which routes to `/work/<slug>`. Data comes from the same bundled content and `about.json` as the corpus, drafts excluded. Inputs are validated against their `inputSchema` before running, and an unknown slug returns an error result.
- **FR-452** Production use in Chrome needs an origin-trial token, sent as an `Origin-Trial` response header from `netlify.toml` (AQ8). Without one, the tools work only behind `chrome://flags/#enable-webmcp-testing`.

## 4. Grounding strategy
- **Full-context, not retrieval.** The public corpus is small: 21 public projects plus résumé, site, and eras come to about 7 K tokens today, and `about.json` adds ≤ 3 K. Sending all of it every time (cached) is simpler, cheaper to build, and more accurate than embeddings or search, and it needs no vector store or tools.
- **Single source.** The corpus builder reads the same JSON the site renders, through the same validator. When Eric edits a project in `/admin` (004), the next deploy updates the answers.
- **Tokens, not links.** The model can only point at things by id (`[[slug]]`). The client resolves ids against the bundle, so a hallucinated project renders as nothing.
- **Measured before launch.** CP5c runs a fixed eval set (plan §5) against a deploy preview: answerable, unanswerable, adversarial, and multi-turn questions, with zero tolerance for invented facts in the unanswerable set.

## 5. Prompt-injection surface

| Input | Trust | What it could do | Mitigation |
| --- | --- | --- | --- |
| Visitor question | Untrusted | Jailbreak, prompt leak, off-topic use, make the bot "say" something as Eric | Rules state visitor text is a question, not an instruction (FR-431). No tools, no secrets in the prompt (the prompt is treated as public). One call, `max_tokens` 2048. Labeled as AI output (FR-420). Eval set includes these cases |
| History | Untrusted | Forged assistant turns used as priming | HMAC-signed assistant turns (FR-438) |
| Corpus | Trusted (Eric's content, validated) | Low. A pasted third-party quote in a project body is still Eric's choice | Same validator as the site |
| Model output | Untrusted | Phishing links, markdown images that leak data, HTML | Text-only rendering, id tokens resolved against a whitelist (FR-432) |
| WebMCP tool input | Untrusted | Odd arguments | Schema validation, read-only tools, `open_project` only routes to known slugs (FR-451) |

## 6. Operations
- A **dedicated Anthropic workspace** ("ethayer-site-ask") holds the only key, so the spend limit, rate limits, and usage reports cover this feature alone. The Console doesn't allow a spend limit on the Default workspace, which is another reason for a separate one.
- Rotation: a new key goes into Netlify's env var, then the old one is revoked in the Console. No deploy needed.

## 7. Cost model (Claude API list prices, 2026-10-25)

| Item | Claude Opus 5.5 ($4 in / $20 out, cache read $0.20, 5-min write $5 per MTok) | Claude Haiku 5.5 ($0.10 / $0.50) |
| --- | --- | --- |
| Cached prefix (≈ 12 K tokens), per hit | $0.0024 | ≈ $0.0001 |
| Cache write (first question in a 5-min window) | $0.060 | ≈ $0.0015 |
| Question plus history (≈ 1 K tokens) | $0.004 | $0.0001 |
| Output plus thinking at `low` effort (≈ 650 tokens) | $0.013 | $0.0003 |
| **Typical answer, warm cache** | **≈ $0.02** | **≈ $0.0005** |
| A 4-question visit (one write) | ≈ $0.12 | ≈ $0.003 |
| $20 monthly cap covers | ≈ 160 visits / ≈ 1,000 answers | far more than traffic |

The 5-minute cache fits how visitors behave (a few questions in a row). A 1-hour TTL doubles the write price and only pays off above about two questions an hour. Haiku 5.5 is roughly 40× cheaper. The default stays Opus 5.5 because a wrong or ungraceful answer costs Eric more than the API does. AQ1 is Eric's call, and the eval (CP5c) should run on both.

## 8. WebMCP status (verified 2026-10-25 from primary sources)
- The spec is a **Draft Community Group Report of the W3C Web Machine Learning CG, dated 2026-10-20**. It is not a W3C Standard and not on the Standards Track.
- The entry point is **`document.modelContext`** with `registerTool(tool, options)`, `getTools()`, and `executeTool()`. A tool is `{ name, title?, description, inputSchema, execute, annotations? }`, and annotations include `readOnlyHint`, `untrustedContentHint`, and `consequentialHint`. Access is gated by the `tools` Permissions Policy, which defaults to `self`.
- Chrome has an **origin trial from Chrome 149**, and a local flag (`chrome://flags/#enable-webmcp-testing`). Agents that call the tools today are mainly Chrome extensions and test inspectors. Firefox and Safari have not committed.
- Conclusion: build it last, keep it small and read-only, and expect the API to change before it ships by default. Sources: [WebMCP draft](https://webmachinelearning.github.io/webmcp/), [Chrome for Developers: WebMCP](https://developer.chrome.com/docs/ai/webmcp).

## 9. Constitution impact (needs owner approval)
- **A1 · II.2 "Runtime dependencies: zero."** The function needs `@anthropic-ai/sdk` at runtime on Netlify. Proposed wording: "The **browser** bundle has zero runtime dependencies. Server functions under `netlify/functions/` may depend on the official `@anthropic-ai/sdk`, pinned to an exact version. Nothing a function imports may reach a browser chunk." The alternative, raw `fetch` to the Messages API with a hand-written SSE parser and error typing, is more code to maintain and is what the SDK exists to avoid. **Recommended: approve A1.**
- **A2 · VII "No third-party trackers."** Sending visitor text to Anthropic is a data processor, not a tracker, but it is a new third-party data flow. Proposed addition: "Visitor-typed text may be sent to a third party only from a server function, only on an explicit submit, behind a visible notice (005 FR-440), and is never logged by this site (FR-441)." **Recommended: approve A2.**
- **No CSP change.** `/api/ask` is same-origin (`connect-src 'self'`). The WebMCP origin-trial token is a response header, not a CSP source.
- **Design lock.** No amendment needed: FR-400 (the header item) and the new dialog go through a normal checkpoint, **CP5a**. The wall, hero, cards, and project dialog are untouched.
- **Budgets.** Initial JS grows only by the route entry (≤ 0.4 KB gzip). `<ask-dialog>` is a lazy chunk with a ≤ 8 KB gzip gate, inside the 50 KB total. Its CSS is ≤ 2 KB gzip, inside the 20 KB CSS budget. WebMCP is a separate lazy chunk ≤ 2 KB. `T404` records today's headroom first.

## 10. Phasing and goal #1
Goal #1 (finish 004 `edit-layer`) stays first. `edit-layer` is blocked on CP4d, which is Eric's smoke publish, not agent time.

| Phase | Content | Starts | Gate |
| --- | --- | --- | --- |
| 0 · Content (Eric) | `about.json` draft, 8–16 chips with answers | Any time | Eric's own review |
| 0 · Pure core | Types, validator rules, corpus builder, render parser, stream protocol (T400–T403) | During the CP4d wait if AQ6 = yes. On a branch, no review asked until CP4e | none |
| 1 · Ask, static | Header item, `/ask` route, `<ask-dialog>` with chips, static `/ask` page | After CP4e | **CP5a** design, **CP5b** ship |
| 2 · Ask, Claude | Function, composer, streaming, controls, eval | After CP5b and A1/A2 | **CP5c** eval and ops review before `ASK_ENABLED=true` on production |
| 3 · WebMCP | Read-only tools, `open_project` | After CP5c, optional | **CP5d** |

Later, the edit-layer can edit `ask.json` and `about.json` from `/admin` (004 lists site and résumé editing as v2). Keeping both in the shared validator now makes that cheap.

## 11. Boundaries
- **Always**: render model output with `textContent` through the FR-432 parser. Keep the key server-side. Exclude drafts from the corpus. Cite FR ids in tests.
- **Ask first**: any change to the wall, hero, cards, or project dialog. A new CSP source. Logging any visitor text. Tools or retrieval in the model call. Raising the spend cap.
- **Never**: `innerHTML`. A key, model name, or prompt in client code. Rendering a URL the model wrote. Storing conversations. Updating a visual baseline without the owner's written approval.

## 12. Success criteria
1. US-A1–US-A5 pass in e2e (Phase 2 against a mocked function), and axe reports zero violations on every dialog state: empty, chip answer, streaming, complete, stopped, each error, and AI off.
2. Public initial JS grows ≤ 0.4 KB, and the ask chunk is ≤ 8 KB gzip.
3. The CP5c eval shows zero invented facts on the unanswerable set and zero rendered off-site URLs, and Eric signs off on the transcripts.
4. With `ASK_ENABLED=false`, or the API failing, the chips still work, and no error reaches the console.

## 13. Open questions
- **AQ1** Model: Claude Opus 5.5 (default, ≈ $0.02 per answer) or Claude Haiku 5.5 (≈ $0.0005)? Run the eval on both before deciding.
- **AQ2** Monthly spend limit on the dedicated workspace. Default $20.
- **AQ3** Log question text (for example 30 days, to improve chips)? Default no.
- **AQ4** Personal scope: only what is in `about.json` (default), or also an explicit "don't discuss" list in the rules?
- **AQ5** Entry: the header item only (default), or also a line in the hero footer? The hero is locked under CP2, so that would be a separate approval.
- **AQ6** Run the pure-core tasks T400–T403 on a branch during the CP4d wait? Default yes. They need no review until CP4e.
- **AQ7** Approve amendments A1 and A2 (§9)?
- **AQ8** Register a WebMCP origin-trial token for the production domain, or stay flag-only? Default: flag-only until Phase 3 starts.
- **AQ9** Label: "Ask" (default) or "Ask about Eric"?
