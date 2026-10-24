# ethayer-design-timeline

A career timeline for [Eric Thayer](https://ethayer.design): a fluid bento wall of project cards. About one card in four is a Swiss-style poster with generated artwork. The rest are media tiles showing a screenshot, a short video loop, a live (non-interactive) iframe, or a placeholder. Each card opens a full-screen dialog with the project details. The wall scrolls vertically, and switches to horizontal scrolling on screens wider than 1800 px.

**Status:** v1 is built and waiting for the owner's review (CP1 in [tasks.md](specs/001-timeline-wall/tasks.md)).

Built with vanilla TypeScript and Custom Elements (light DOM, native ES modules), with zero runtime dependencies.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + unit tests
npm run build      # production build in dist/
npm run budgets    # gzip sizes vs constitution §V
npm run e2e        # Playwright + axe (builds and serves dist/)
npm run og         # regenerate the link-preview images in public/og/
```

## Add a project

1. Add an entry to the right era file in `src/content/projects/`. The `Project` type allows only valid size × media pairs, so wrong combinations fail typecheck.
2. Choose the card media: `{ kind: 'placeholder', variant }` until you have an asset, then `image`, `video`, or `iframe`.
3. For screenshots: commit the raw image as `media-src/<slug>/cover.png` (or `.jpg`, `.jpeg`, `.webp`, `.avif`; at least 480 px wide, at most 10 MB) and reference it as `src: '<slug>/cover'`. `npm run media` (which `dev`, `build`, and `check` run first) writes the AVIF and WebP sizes to `public/media/<slug>/` and generates `src/content/media-manifest.json`. Both are build output and aren't committed.
4. For a video loop: `npm run media:clip -- <slug> <https-url | full-page-image>` writes `media-src/<slug>/clip.{mp4,webm}`.
5. For a live iframe, add its origin to `frame-src` in `netlify.toml`.
6. Run `npm run og` to render the project's link-preview poster, and commit the new PNG and `src/content/og-manifest.json`.
7. Run `npm run check`. The content tests flag duplicate slugs, missing alt text, missing files, titles that are too long, a CSP gap, a Swiss share outside 20–30 %, or a link-preview image that is missing or out of date.

## Prerender and link previews

`vite build` turns the app shell into one page per route (`scripts/vite-prerender.ts`):

- `work/<slug>.html` and `index.html` each get their own `<title>`, description, canonical URL, Open Graph, and Twitter tags, so pasted links preview correctly in Slack, iMessage, LinkedIn, and X.
- The same pages carry static content inside `<noscript>`, so visitors without JavaScript get the project story (or the full project list on `/`). With JavaScript on, nothing changes on screen.
- The build also writes `sitemap.xml` (drafts left out), `robots.txt`, and a `_redirects` file that makes Netlify serve each page at `/work/<slug>`.
- Absolute URLs come from `SITE_URL`, else Netlify's `URL` (production) or `DEPLOY_PRIME_URL` (previews), else `https://ethayer-design.netlify.app`. A custom domain needs no code change.

The preview images (`public/og/*.png`, 1200 × 630) are rendered locally by `npm run og` from `tools/og-card.html` and committed, because the Netlify build has no browser. `npm test` fails if a project, the palette, the font, or the artwork code changes without regenerated images. `npm run og -- <slug>` re-renders one card, but only while the template is unchanged. After a style or artwork change, run `npm run og` for the full set.

## Docs

| Doc | Purpose |
| --- | --- |
| [specs/constitution.md](specs/constitution.md) | Rules every change must follow |
| [specs/001-timeline-wall/spec.md](specs/001-timeline-wall/spec.md) | What and why: stories, requirements, resolved questions |
| [specs/001-timeline-wall/research.md](specs/001-timeline-wall/research.md) | Findings: reference analysis, inventory, iframe frameability |
| [specs/001-timeline-wall/data-model.md](specs/001-timeline-wall/data-model.md) | Types, themes, motifs, content inventory |
| [specs/001-timeline-wall/plan.md](specs/001-timeline-wall/plan.md) | Architecture, decisions, layout, testing |
| [specs/001-timeline-wall/tasks.md](specs/001-timeline-wall/tasks.md) | Ordered todo list with approval checkpoints |

Hanken Grotesk is licensed under the SIL Open Font License (`public/fonts/OFL-hanken-grotesk.txt`).
