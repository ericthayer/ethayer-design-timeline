# Plan 004 · media-pipeline

| Field | Value |
| --- | --- |
| Status | **Draft (2026-10-24)** |
| Owner | Eric Thayer |
| Companions | [spec-media-pipeline](./spec-media-pipeline.md) · [tasks-media-pipeline](./tasks-media-pipeline.md) · [capability map](./capability-map.md) |

## 1. Components

| Component | Kind | Responsibility | FRs |
| --- | --- | --- | --- |
| `src/core/media-rules.ts` | pure, browser-safe | Path parsing, key mapping, limits, width selection, crop box, passthrough decision, video pairing, manifest build and serialization | FR-320–FR-325, FR-328, FR-329, FR-334, FR-336 |
| `scripts/build-media.ts` | Node I/O (renamed from `optimize-images.ts`) | Walks `media-src/`, reads metadata with sharp, runs the rules, encodes or copies, writes `public/media/` and both manifests atomically, removes stale outputs, prints errors | FR-326, FR-327, FR-330 |
| `scripts/media-cache.ts` | Node I/O | Cache key (SHA-256), lookup, store, and prune under `.cache/media/` | FR-332 |
| `netlify/plugins/media-cache/` | Netlify local plugin | `onPreBuild` restores and `onPostBuild` saves `.cache/media`. It never fails the build | FR-333 |
| `package.json` · `netlify.toml` · `ci.yml` · `.gitignore` | config | Build order, dev workflow, CI cache, ignore rules | FR-330, FR-331, FR-333, FR-335 |

Data flow: `media-src/**` → `parseSourcePath` + `checkSource` (all errors collected) → per source: cache key → hit: copy · miss: sharp (rotate → crop → resize per `selectWidths` → avif/webp, or passthrough) → store in cache → `public/media/<slug>/…` → `buildManifest` → `serializeManifest` → `src/content/media-manifest.json` + `video-manifest.json` (temp + rename).

`build-media.ts` exports `runMediaPipeline(dirs): Promise<PipelineReport>` (with `encoded`, `cached`, `copied`, and `errors`). The CLI wrapper calls it with the repo paths and sets the exit code. The integration test calls it with temp directories.

## 2. Order

1. **Pure rules first** (T320, T321). Everything else consumes them, and they are fully testable without sharp.
2. **Pipeline and cache** (T322, T323), still writing to `public/media/` so the site keeps working. Proven against synthetic fixtures before touching real media.
3. **Wiring** (T324): scripts and `capture-clip.ts` output. The build now runs media, but sources don't exist yet, so this task lands together with T325 in one PR.
4. **Migration** (T325), then the **content test** swap (T326). After this, `public/media/` and the manifest leave git.
5. **Persistence** (T327 Netlify plugin, T328 CI cache), then **verification on a deploy preview** (T329) → CP4b.

Coordination: `content-json` (T300–T319) also edits the `build` script and `content.test.ts`. Whichever lands second rebases. The fixed contract: `npm run media` comes first, then `content-json`'s order (`tsc --noEmit && npm run content:check && vite build`). `github-publish` already matches the 10 MB cap and supports `put-binary` and `delete`. Its `.gif` allowlist entry is MQ7.

## 3. Risks and mitigations

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| **Cold build time.** 8 sources × 3 widths × 2 formats, and AVIF is the slow encoder | Medium | Cache (FR-332). Outputs per source run in parallel with `Promise.all`, sources run sequentially to bound memory, and sharp's default thread pool applies. T329 records cold and warm timings against SC-M1 (≤ 60 s) and SC-M2 (≤ 5 s). If cold time is over budget, lower AVIF `effort` to 3 (Ask first: pixels change) |
| **sharp on Netlify's Linux image.** sharp ≥ 0.33 ships prebuilt `@img/sharp-linux-x64` binaries as optional dependencies. A lockfile made on macOS can miss them (an npm optional-deps bug) | Medium | T328 runs `npm run media` in CI on `ubuntu-latest` (glibc x64, the same family as Netlify's Ubuntu 24.04 image; image version is medium confidence, to verify) **before** any Netlify deploy depends on it. If binaries are missing, refresh the lockfile following sharp's cross-platform install guide (`npm install --os=linux --cpu=x64 sharp`, to check against the sharp docs for 0.35) |
| **Netlify cache API.** Local plugins (`manifest.yml` + `index.js`, referenced as `[[plugins]] package = "./netlify/plugins/media-cache"`) and `utils.cache.restore/save(path)` are high confidence. ESM loading for a local plugin, and whether `onPostBuild` runs before upload, need checking against Netlify docs in T327 | Low–medium | The plugin is an optimization only. Every call is in try/catch and logs a warning. Failure mode: a cold encode (SC-M1 still holds). "Clear cache and deploy" in the Netlify UI is the same path |
| **Cache poisoning or staleness** | Low | The key covers source bytes, options, `PIPELINE_VERSION`, and `sharp.versions`. Cached `meta.json` is re-validated, and any mismatch counts as a miss. Bump `PIPELINE_VERSION` whenever pipeline behavior changes |
| **Generational loss in migration** | Certain, small | Passthrough keeps the largest WebP byte-identical. The rest are downscales of a 1440 px source. MQ1 lets the owner swap in originals at any time with a drop-in replacement |
| **Pixel drift vs. future visual baselines** | Low (none exist yet) | If baselines land before T325, any diff goes to the owner; the agent never re-baselines (constitution I.2) |
| **Fresh-clone friction.** `tsc` and Vitest import a manifest that doesn't exist yet | Medium | `dev`, `build`, and `check` run `npm run media` first. A bare `npx vitest` fails on the missing import, and the testing notes say to run `npm run media` once |
| **Editor publish lands before its image is encoded** | — | Not possible: the commit carries the source, and the same build encodes it before validation (FR-331). Only that one source is a cache miss |
| **Repository size** | Low | Raw sources replace the encoded set (about 0.5 MB net after migration). Old binaries stay in history. The 10 MB per-file cap bounds growth |

## 4. Checkpoints

- **PR 1 (T320–T323)**: rules and pipeline behind tests. No behavior change on the site.
- **PR 2 (T324–T326)**: switches the build and migrates. Its description lists the before-and-after manifest diff: same keys and `widths`, and the `width`/`height` changes.
- **PR 3 (T327–T329)**: persistence and deploy-preview evidence (timings, the hand-dropped image test).
- **CP4b**: the owner reviews the deploy preview and the migration diff and answers MQ1–MQ4. Work in `edit-layer` that uploads media (FR-337) waits for CP4b.
