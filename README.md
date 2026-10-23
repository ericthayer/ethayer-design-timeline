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
```

## Add a project

1. Add an entry to the right era file in `src/content/projects/`. The `Project` type allows only valid size × media pairs, so wrong combinations fail typecheck.
2. Choose the card media: `{ kind: 'placeholder', variant }` until you have an asset, then `image`, `video`, or `iframe`.
3. For screenshots: put `<slug>.png` (or `.jpg` / `.webp`) in a folder and run `npm run media:images -- <folder>`. This writes AVIF and WebP files to `public/media/<slug>/` and updates `src/content/media-manifest.json`. Reference it as `src: '<slug>/cover'`.
4. For a video loop: `npm run media:clip -- <slug> <https-url | full-page-image>`.
5. For a live iframe, add its origin to `frame-src` in `netlify.toml`.
6. Run `npm run check`. The content tests flag duplicate slugs, missing alt text, missing files, titles that are too long, a CSP gap, or a Swiss share outside 20–30 %.

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
