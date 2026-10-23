# Project Constitution — ethayer-design-timeline

These rules apply to every spec, plan, task, and commit in this repo. If a spec conflicts with this file, this file wins. Changing a rule here requires the owner's approval.

## I. Design lock

1. Once a checkpoint (`CP*` in a `tasks.md`) is approved, its visual design is **locked**. That covers colors, typography, spacing, grid, composition, and motion.
2. The lock is enforced by Playwright visual baselines (`tests/visual/**`). An agent may not update a locked baseline unless the owner approves that change in writing in the PR or issue thread.
3. Never revert styling (CSS or layout) or scripting (TS) changes the owner made on purpose. If one seems wrong, ask.
4. Scope discipline: change only what the active task names. Don't touch the header while building the dialog, and so on.

## II. Platform first

1. Use vanilla TypeScript and Custom Elements in the **light DOM**, shipped as native ES modules. No UI framework runtime.
2. **Runtime dependencies: zero.** Dev dependencies (build, test, lint, media tooling) are fine.
3. Build DOM with `document.createElement`, `<template>` cloning, and `textContent`. **`innerHTML` is banned**, including for trusted content.
4. Load heavy, non-critical code (dialog, router) with dynamic `import()`.

## III. Components

1. Each component lives in `src/components/<name>/` with its own `.ts` and `.css`. All are exported from `src/index.ts`.
2. Each component exports its class and an idempotent `define()`. Components never self-register just because they were imported.
3. Keep files at 300 lines or fewer. Pure logic (ordering, formatting, layout math, scheduling) goes in `src/core/` or `src/content/` and is unit tested without a DOM.
4. Styles go in `@layer components`. Nothing inline: themes and sizes use `data-*` attributes and classes. Runtime values are custom properties set with `style.setProperty` (CSSOM, which CSP allows).

## IV. Accessibility: WCAG 2.2 AA

1. Use semantic HTML first. ARIA only fills real gaps.
2. CI must show zero axe-core violations on every route and state the e2e suite reaches.
3. Every interaction works by keyboard. Focus is always visible (a double ring that passes 3:1 on any theme) and never hidden under the sticky UI (SC 2.4.11).
4. Honor `prefers-reduced-motion`. Provide a **global motion pause** (SC 2.2.2) that stops video loops and live iframes.
5. Text contrast is ≥ 4.5:1 (≥ 3:1 for large display text). Tests check it against the theme tokens.
   - **Amendment (owner-approved 2026-10-23):** Swiss-treatment poster cards *aim* for AA, but Level A is acceptable for their visual styling (contrast of decorative and poster type). Everything else on the site, including the label, link, and focus behavior of those cards, stays AA.
6. Font sizes have a `rem` floor so user font-size settings still apply (SC 1.4.4).

## V. Performance budgets (enforced in CI)

| Metric | Budget |
| --- | --- |
| Initial JS (gzip) | ≤ 25 KB (hard cap 50 KB including lazy chunks) |
| CSS (gzip) | ≤ 20 KB |
| Fonts | ≤ 60 KB, one variable woff2, Latin subset |
| LCP (4G, mid-tier mobile) | ≤ 2.5 s |
| CLS | ≤ 0.05 |
| INP | ≤ 200 ms |
| Lighthouse | Perf ≥ 90, A11y = 100, Best Practices ≥ 95 |

## VI. Type safety

TypeScript runs in `strict` mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any`. Every function declares its return type. Variants are discriminated unions, and the content types make invalid combinations unrepresentable.

## VII. Security and privacy

A strict CSP with no `unsafe-inline`. Every iframe is sandboxed with minimal `allow`, and `frame-src` is generated from the content data. No third-party trackers. Third-party players (Vimeo) load behind a click-to-load facade.

## VIII. Spec-driven workflow

`spec.md` (what and why) → `plan.md` (how) → `tasks.md` (ordered work) → implementation. Every task cites the requirement IDs it covers. If behavior has to change, update the spec **first**, then the code.
