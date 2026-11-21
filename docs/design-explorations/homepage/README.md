# Homepage design explorations

Sources for the homepage mockup versions reviewed in the Artifact board (versions 1 to 15). These are design references, not part of the site build. Nothing here is imported by `src/` or run by `npm run build`.

- `mock-data.json`: project rows, stats, categories and career eras used by the mockups.
- `mock2.css`: layered overrides, one class per version (`.v5` to `.v15`).
- `mock2.cjs`: Playwright script that builds each version on the live site and writes full-page captures at 1280 and 390 px. Run it from this folder with `node mock2.cjs <letters>`, for example `node mock2.cjs q`. The `CAREER_ART` environment variable swaps the Career banner artwork.

The captures and the review board are not committed. Their live location is the Artifact board.

## Swiss art direction review

Run `npx vite --host 127.0.0.1 --port 5174` from the repository root, then open
`http://127.0.0.1:5174/docs/design-explorations/homepage/swiss-review.html`.
This standalone review uses the real project-card components and revised SVG generators
in the approved homepage composition. This archived comparison page is separate from the
production implementation in `src/components/site-home/`, which now renders at `/`. Artwork is
contained, section type and art occupy separate columns, and the mobile layout stacks.

Netlify PR deploy previews also build this page at the same path using `npm run build:review`
after the normal build. The production build does not include it. To inspect the compiled
review locally, run `npm run build && npm run build:review && npm run preview`.
