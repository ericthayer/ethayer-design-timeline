# Plan 006: Experience and Projects views

Companion to [spec.md](./spec.md). This says how; the spec says what and why.

## 1. Approach

Reuse first. Projects is the same `<timeline-wall>` with a different item list, so the bento grid, card sizes, batching, keyboard navigation, horizontal mode and the dialog all come for free and stay under the CP1 lock. The new pieces are small: a grouping function, a marker tile, a header switch, and a footer.

```
src/content/data/categories.json      FR-500   ordered { id, label, description }
src/content/data/category-order.json  FR-503   optional curated order per category
src/content/categories.ts             FR-500   CATEGORIES, CategoryId (like eras.ts / era-ids.ts)
src/content/validate/project.ts       FR-502   categories rules
src/core/order.ts                     FR-510   + buildCategoryItems(projects, categories, order)
src/content/types.ts                  FR-501   Project.categories, WallItem | { type: 'category' }
src/components/wall-tiles/            FR-511   + renderCategory() (era marker styles, count numerals)
src/components/timeline-wall/         FR-510   `view` property; render 'category' items; label per view
src/components/view-switch/           FR-520   new: header nav, aria-current, client nav
src/components/site-footer/           FR-540   new: portrait + copy + links
src/core/router.ts                    FR-521/530  '/projects' route; history state { view }
src/main.ts                           FR-521   swap wall items on view change
scripts/lib/pages.ts                  FR-523   prerender /projects, sitemap, OG
admin edit-layer form                 FR-550   categories fieldset (lands with T38x)
```

## 2. Key decisions

| Decision | Choice | Rejected, and why |
| --- | --- | --- |
| Projects layout | Same `<timeline-wall>`, category markers instead of era markers | A new grid component: duplicates about 190 lines and the batching and keyboard logic, and needs its own design lock |
| Duplicates | One card per project, in its primary category | Showing a card in every category it belongs to: repeated cards, a confused Prev/Next, and screen readers hear the same project twice |
| Routing | `/projects` is a real route, prerendered | A tab widget on `/`: no shareable URL, no prerender, and tabs semantics for what is navigation |
| Contact | A footer after `<main>` on both views | A contact end-cap tile (PR #13): wrong at the end of a newest-first wall, and missing from Projects |
| Category data | `categories.json` plus generated `CategoryId` | Free-text tags: typos split sections, and the editor can't offer a closed list |
| Order in a category | Optional `category-order.json`, newest first by default | Required order: every new project needs two edits |

## 3. Initial category assignment

Primary first, then an optional secondary. Drafts are marked †. The owner confirms at CP6a.

| Project | Primary | Secondary |
| --- | --- | --- |
| `cobank-design-system` | design-systems | front-end-platforms |
| `figma-token-pipeline` | design-systems | agentic-engineering |
| `hs-vue-library` | design-systems | front-end-platforms |
| `vr-design-system` | design-systems | product-design |
| `hs-brand-systems` | design-systems | product-design |
| `onsite-figma-template` | design-systems | |
| `accessible-components` | design-systems | front-end-platforms |
| `agentic-engineering-loop` | agentic-engineering | design-systems |
| `drift-detection` | agentic-engineering | design-systems |
| `navigators-platforms` | front-end-platforms | |
| `responsive-modernization` | front-end-platforms | |
| `onsite-grid-framework` | front-end-platforms | |
| `kentico-framework` | front-end-platforms | design-systems |
| `kyamedia-frameworks` | front-end-platforms | |
| `dmns` | front-end-platforms | design-systems |
| `nyt-ui` | front-end-platforms | |
| `dli-mobile-learning` | front-end-platforms | product-design |
| `qr-landing` † | front-end-platforms | |
| `curiteva` † | front-end-platforms | |
| `design-sprints` | product-design | |
| `sublist` | product-design | |
| `merchants` | product-design | |
| `safetyhive` † | product-design | |
| `madramps` † | product-design | |
| `map-course-launcher` † | product-design | |
| `workbench` † | product-design | front-end-platforms |
| `motion-reel` † | motion-media | |
| `dli-training-media` | motion-media | |

Counts (published + drafts): design systems 7, agentic engineering 2, front-end platforms 10, product design 7, motion and media 2. Agentic engineering and motion are thin today. That's fine with markers sized `sm`, and they grow as projects are added. If the owner wants fewer sections, merge motion into product design.

## 4. Bento fit

Category sections are short (2–10 cards), so dense packing could pull a card from one section into the gap left by the previous one, which would blur the section edges. Mitigation: in Projects mode, each category marker starts a new row (`grid-column-start: 1`) in vertical mode, and a new column in horizontal mode. That leaves at most one partial row per section, which is the Swiss "ragged edge" the wall already shows between eras. This is checked at CP6b at 390, 1280 and 1920 px.

## 5. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Edit-layer (T380+) starts before this lands | The form is built without categories, then reworked | Land T501–T502 (data, types, validator) first. They're small and don't change anything visible |
| Two views double the e2e and axe surface | Slower CI | Parameterize the wall specs over `['/', '/projects']`. Most tests are shared |
| Header switch changes locked header composition | Needs owner approval | The switch is reviewed at CP6b and called out as a header change |
| Portrait resolution (balloon GIF is 640×480) | A soft image on wide screens | Default to the boat photo. Swap if the owner supplies a full-size original (Q3) |
