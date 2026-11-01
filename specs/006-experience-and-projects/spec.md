# Spec 006: Experience and Projects views

| Field | Value |
| --- | --- |
| Status | **Approved (CP6a, 2026-11-01)**: the owner answered Q1–Q5 (§6) |
| Owner | Eric Thayer |
| Amends | [001 spec](../001-timeline-wall/spec.md) FR-072 (end-cap stays as is, contact moves to a footer) · [004 content-json](../004-admin-editing/spec-content-json.md) (new `categories` field) · [004 edit-layer](../004-admin-editing/spec-edit-layer.md) (the editor gets a categories control) |
| Supersedes | T078 / PR #13 (Education tile near the start and a contact end-cap). It's on hold, and its portrait work moves into the footer here |
| Companions | [plan.md](./plan.md) · [tasks.md](./tasks.md) · [constitution](../constitution.md) |

## 1. Summary

The owner is adding more projects, and the newest-first wall works as a career story but not as a portfolio. A newest-first wall ends at 2003, so it's the wrong place for a contact card (PR #13).

This spec splits the site into two views of the same project data, plus a contact footer:

1. **Experience** (`/`): the current wall, unchanged. Eras newest first, ending on the Education end-cap ("Start of the timeline").
2. **Projects** (`/projects`): the same cards in a bento grid **grouped by category** instead of by era.
3. **Contact footer**: a closing band below both views, with Eric's portrait, one line of copy, and contact links. It replaces the idea of a contact end-cap.

The project dialog (`/work/:slug`) is shared by both views.

## 2. User stories

### US20 (P1). Browse by kind of work
- **Given** `/projects`, **then** I see every published project once, in category sections (Design systems, Agentic engineering, …), each opened by a category marker tile.
- **Given** a card, **when** I open it, **then** the same dialog opens as on Experience, and Prev/Next follow the Projects order.
- **Given** the dialog was opened from Projects, **when** I close it, **then** I'm back on `/projects` with focus on the card.

### US21 (P1). Switch views
- **Given** any page, **then** the header has an "Experience · Projects" switch. The current view is marked (`aria-current="page"`), and both are real links that work without JavaScript (prerendered).
- **Given** I switch views, **then** the URL changes, the page title updates, the scroll position resets to the top of the wall, and focus moves to the wall.

### US22 (P1). Reach Eric from either view
- **Given** the bottom of either view, **then** a contact footer shows a portrait, a short line, and links to Résumé, LinkedIn, GitHub, and Email.
- **Given** the Experience view, **then** the end-cap is still the Education / "Start of the timeline" tile, and the footer follows it.

### US23 (P2). Categorize a project in /admin
- **Given** the editor (004 edit-layer), **then** each project has a categories control: one primary category (required) and up to one secondary.

## 3. Functional requirements

### Content
- **FR-500** New `src/content/categories.ts`: an ordered `CATEGORIES` list of `{ id, label, description }`, and `CATEGORY_IDS` as a TS vocabulary like `ERA_IDS`. The order is the order of the Projects sections. *Amended at T501 (2026-11-01):* the list is TS, not a `categories.json` document, because editing it stays code-only (FR-551), and a document would add a validator, a bundle entry and an editor read for no gain. Initial set (approved, Q1):

| id | Label |
| --- | --- |
| `design-systems` | Design systems |
| `agentic-engineering` | Agentic engineering |
| `front-end-platforms` | Front-end platforms |
| `product-design` | Product and UX design |
| `motion-media` | Motion and media |

- **FR-501** `Project.categories: readonly [CategoryId] | readonly [CategoryId, CategoryId]`. The first entry is the primary. Projects appear **once**, in their primary section. The secondary is shown as a tag on the dialog (and is ready for filters later), never as a duplicate card.
- **FR-502** The shared validator rejects a missing or empty `categories` field, unknown ids, a duplicate id, and more than two entries. Unknown ids are rule `category-ref`. `CategoryId` comes from `CATEGORY_IDS` the same way `EraId` comes from `ERA_IDS`.
- **FR-503** Order inside a category is the Experience order (eras newest first, then `order.json` within each era), filtered to that category. *Amended at T501 (2026-11-01):* the separate `category-order.json` is deferred until the owner asks for a different order on Projects. Adding a project never needs a second edit.
- **FR-504** Initial assignment of the 28 projects is in [plan.md §3](./plan.md#3-initial-category-assignment). The owner reviews it at CP6a.

### Projects view
- **FR-510** `/projects` renders `<timeline-wall>` with a category grouping. Build-time order: category sections in `CATEGORIES` order, each with a **category marker** tile, then its projects. Card sizes, themes, media, batching, keyboard navigation, and horizontal mode above 1800 px all behave as they do on Experience (001 FR-001–FR-007, FR-070–FR-073, FR-081).
- **FR-511** The category marker is an `sm` tile in the same style as the era marker (locked styling). It shows the category label and a two-digit project count (for example `07`) instead of the era years.
- **FR-512** Projects has no end-cap. The last section is followed by the contact footer.
- **FR-513** The grid's accessible name is "Projects by category". Each marker's label is an `h2`, so screen-reader heading navigation jumps between sections.
- **FR-514** Drafts follow the same rule as on Experience: they show in development and `/admin` previews, and are excluded from the sitemap and `noindex`.

### View switch
- **FR-520** The header gets a `<nav aria-label="Views">` with two links: "Experience" (`/`) and "Projects" (`/projects`). The active one gets `aria-current="page"`. It sits with the brand on the left, separate from the contact nav. The role line under the name stays "Principal Design Engineer", without "· Career timeline". *Added at T506:* below 720 px the brand is hidden (the hero names Eric right below), and below 480 px the motion toggle shows its icon only, keeping "Pause motion" as its accessible name, so the switch, Résumé and the toggle fit on one line down to 320 px.
- **FR-521** With JavaScript, switching is client-side: the router rebuilds the wall's items, resets the batches, scrolls to the wall, and moves focus to it. It uses a View Transition when one is available and motion is not paused (core `transition.ts`).
- **FR-522** The skip links follow the view: "Skip to projects" goes to the wall, and "Skip to end of timeline" shows on Experience only.
- **FR-523** Titles: Experience keeps `HOME_TITLE`. Projects is "Projects — Eric Thayer", with its own description, canonical, and OG image (`/og/projects.png`), prerendered like the home page (001 FR-130–FR-136).

### Dialog
- **FR-530** `/work/:slug` keeps one URL for both views. The history state records the view the dialog opened from. Closing returns to that view. A cold deep link opens over Experience (unchanged behavior).
- **FR-531** Prev/Next follow the order of the view the dialog was opened from.
- **FR-532** The dialog shows the project's categories in its facts list as a "Focus" row (labels joined by " · ", primary first), using the existing facts styles.

### Contact footer
- **FR-540** A new `<site-footer>` component, rendered once after `<main>` on both views (not a grid item). On the left: an `h2` "Let's talk", one line of copy, and the links Résumé, LinkedIn, GitHub, and Email from `site.json`. On the right: Eric's portrait.
- **FR-541** The portrait goes through the media pipeline (`media-src/site/portrait.png`): AVIF and WebP, `loading="lazy"`, intrinsic size, descriptive alt text. It ships as a **placeholder** at the recommended source size, 1440 × 1800 px (4:5), so the pipeline emits all three widths (480, 960, 1440). The owner replaces the file with the final photo later, and only the alt text (`PORTRAIT_ALT` in `site-footer`) changes with it (Q3).
- **FR-542** The footer uses the existing tokens only (paper panel, ink background, vermilion title). Its layout is new, so it's reviewed at CP6b.
- **FR-543** The Experience end-cap stays exactly as it is on `main` (001 FR-072, unamended). PR #13's early Education tile is dropped: Education stays in the end-cap and in the résumé (Q4).

### Admin (amends 004 edit-layer)
- **FR-550** The project form gets a "Categories" fieldset: a required primary `<select>` and an optional secondary `<select>` (which can't equal the primary). It's validated by the shared validator (FR-502).
- **FR-551** Adding or renaming categories (`src/content/categories.ts`) stays code-only in this spec.

## 4. Non-functional

- **Budgets (constitution V).** Projects reuses the wall chunk. The new code is the category grouping, the marker, the view switch, and the footer, estimated at about 1.5 KB gzip of JS and about 0.6 KB of CSS. Initial JS stays under 25 KB (19.9 KB today).
- **CLS ≤ 0.05.** The footer image has intrinsic size, and switching views doesn't shift the header.
- **A11y (constitution IV).** Zero axe violations on `/`, `/projects`, and a dialog opened from each. The view switch, sections, and footer are fully keyboard operable, and focus is visible and never under the sticky header.
- **SEO.** `/projects` is in the sitemap. `/` stays canonical for the home page.

## 5. Out of scope

- Filters or search on Projects (the secondary category makes them possible later).
- Changing which view is the home page (Q2: decide after CP6b with real content).
- New Swiss motifs or new themes.
- Editing the category list from `/admin`.

## 6. Owner decisions (2026-11-01)

| # | Question | Answer |
| --- | --- | --- |
| Q1 | Are these five categories and labels right? | Yes, the five in FR-500 |
| Q2 | Should `/` stay Experience, or should Projects become the home page? | Experience stays `/` |
| Q3 | Which portrait goes in the footer? | A placeholder at the recommended size. The owner uploads the final photo later |
| Q4 | Drop the early Education tile from PR #13? | Yes, drop it |
| Q5 | Who writes the footer copy? | Claude drafts it, reviewed at CP6b |

## 7. Checkpoints

- **CP6a**: the owner approves this spec, the category list, and the initial assignment.
- **CP6b**: the owner reviews the running build (Projects grid, view switch, footer). Approval locks the new visuals. Baselines need the owner's written OK.
