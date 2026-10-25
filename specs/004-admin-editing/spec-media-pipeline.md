# Spec 004 · media-pipeline: build-time media optimization

| Field | Value |
| --- | --- |
| Status | **Draft (2026-10-24)**: from the approved [capability map](./capability-map.md) (assumption 6, resolved question 3). Awaiting the owner's review |
| Owner | Eric Thayer |
| Companions | [plan-media-pipeline](./plan-media-pipeline.md) · [tasks-media-pipeline](./tasks-media-pipeline.md) · [001 spec](../001-timeline-wall/spec.md) (FR-030, FR-031, FR-090, FR-091) · [constitution](../constitution.md) |

## 1. Objective

Raw images and clips are committed under `media-src/`. The build (Netlify, CI, and local) validates them and turns them into today's AVIF/WebP sizes plus `media-manifest.json` **before** content validation and `vite build`. This module doesn't depend on the editor: a file the owner drops in by hand behaves exactly like one the editor commits. It **supersedes FR-090's media location** (`public/media/<slug>/` becomes build output).

Acceptance criteria:
- **Given** `media-src/dmns/cover.png` and content that references `'dmns/cover'`, **when** Netlify builds, **then** `/media/dmns/cover-{480,960,1440}.{avif,webp}` are served and the card renders with no other step.
- **Given** a corrupt, oversized, or too-narrow source, **then** the build fails with one line per problem naming the file, and Netlify keeps the last good deploy.
- **Given** a deploy where no source changed, **then** nothing is re-encoded (cache hit), and the manifest is byte-identical to the previous build's.
- **Given** a fresh clone, **when** the owner runs `npm run dev`, **then** the site works with no other setup step.
- **Given** the migration, **then** the manifest keeps the same keys and `widths`. Only `width`/`height` change, to the migrated source's size (same aspect ratio, ±0.1 %).

## 2. Functional requirements

### Sources
- **FR-320** Layout: `media-src/<slug>/<name>.<ext>`, exactly one folder deep. `<slug>` and `<name>` match `^[a-z0-9]+(-[a-z0-9]+)*$`, and extensions are lowercase. Dotfiles (`.DS_Store`) are ignored. Any other file or nesting is an error.
- **FR-321** Key mapping: a source's manifest key is `'<slug>/<name>'` (`media-src/dmns/cover.webp` → `'dmns/cover'`), which is what `ImageMedia.src` and `VideoMedia.src` hold today. Outputs keep today's URLs: images at `/media/<slug>/<name>-<w>.<avif|webp>`, clips at `/media/<slug>/<name>.<mp4|webm>`. Two image sources with the same key (`cover.png` and `cover.webp`) are an error.
- **FR-322** Limits. Images: `jpg`, `jpeg`, `png`, `webp`, `avif`. ≤ 10 MB file, ≥ 480 px wide (the smallest output), ≤ 50 MP decoded (sharp `limitInputPixels`). Videos: `mp4` and `webm`, both required per key, each ≤ 1.5 MB (FR-031). Any other extension is an error.

### Processing
- **FR-323** Widths: `TARGET_WIDTHS = [480, 960, 1440]` (today's set), filtered to `w ≤ source width`. The pipeline **never upscales**. A 1400 px source yields `[480, 960]`, as `madramps` does today.
- **FR-324** Geometry: sources named `cover` that are taller than 16:10 are cropped from the top to 16:10 (today's rule for full-page screenshots). Other names keep their aspect ratio, so gallery `tall` tiles can be portrait. Every image is auto-oriented from EXIF, converted to sRGB, and stripped of metadata.
- **FR-325** Encoding: AVIF `quality 50, effort 4`, WebP `quality 72, effort 4`, the same as today with explicit effort. **Passthrough:** when a WebP or AVIF source wasn't cropped and its width equals a target width, that format at that width is copied byte for byte, not re-encoded. This avoids generational loss for the migrated covers.
- **FR-326** Videos pass through byte for byte, with **no transcoding at build**. Encoding stays in `npm run media:clip` (ffmpeg, local only), which now writes to `media-src/<slug>/`. A poster is an ordinary image source referenced by `VideoMedia.poster.src`.
- **FR-327** Failure: every source is checked before anything is written. Problems are collected and printed one per line as `<path>: <reason>` (for example `media-src/dmns/cover.png: 320 px wide, minimum is 480`), and then the build exits 1. sharp decode errors (corrupt files) are reported the same way. Manifests are written atomically (temp file + rename), so a failed run never leaves a partial manifest.

### Outputs
- **FR-328** `src/content/media-manifest.json` keeps its shape `{ width, height, widths }` per image key, plus one additive field, `source` (the source file name with its extension, e.g. `"cover.webp"`). That lets the editor delete exactly the right file when it replaces or removes an image (cross-spec X1 from spec-edit-layer). `width`/`height` are the source size after the crop. Keys are sorted by UTF-16 code unit (not `localeCompare`), `widths` ascending, with 2-space JSON and a trailing newline.
- **FR-329** `src/content/video-manifest.json`: `{ "<slug>/<name>": { "formats": ["mp4", "webm"] } }`, sorted the same way. This lets the Netlify build (which doesn't run Vitest) catch a missing clip. `content-json`'s `media-key` rule covers images and posters today, and MQ6 asks it to read these keys for `VideoMedia.src` too.
- **FR-330** The pipeline owns `public/media/` and removes any file in it that the current run didn't produce. `public/media/`, both manifests, and `.cache/` are gitignored. `dist/` gets media through Vite's `public/` copy, as today.

### Build, cache, determinism
- **FR-331** Build order (`npm run build`, also Netlify's command): `npm run media && tsc --noEmit && npm run content:check && vite build`. This module only prepends `npm run media` to `content-json`'s FR-310 order, because `tsc` and `content:check` both read the generated manifest. `npm run check` also runs `npm run media` first, because Vitest imports the manifest.
- **FR-332** Cache: content-addressed entries under `.cache/media/<key>/` (outputs + `meta.json`). The key is the SHA-256 of the source bytes, the image name rule (cover crop or not), the encoder options, `PIPELINE_VERSION`, and `sharp.versions` (sharp + libvips). A hit copies the files. A miss, a missing file, or an unreadable `meta.json` re-encodes. Entries this run didn't use are pruned. The cache is never required: deleting it only costs time.
- **FR-333** Cache persistence. Netlify: a local build plugin `netlify/plugins/media-cache/` (no npm dependency) restores `.cache/media` in `onPreBuild` and saves it in `onPostBuild` with `utils.cache`. Every call is wrapped in try/catch and never fails the build. CI: `actions/cache@v4` keyed on `hashFiles('media-src/**', 'scripts/build-media.ts', 'src/core/media-rules.ts', 'package-lock.json')`. Local: `.cache/media` simply persists.
- **FR-334** Determinism: the same sources produce a byte-identical manifest on any machine. Encoded bytes are expected to be identical for the same platform and sharp version, but they aren't committed, so differences across platforms don't matter.
- **FR-335** Dev: `npm run dev` runs `npm run media` (warm: about 1 s) and then `vite`. After adding a file while the server runs, run `npm run media` again. Vite serves the new `public/media` files and reloads on the manifest change. v1 has no watch mode.

### Interfaces for other modules
- **FR-336** `src/core/media-rules.ts` is pure and **browser-safe** (no `node:*`, no sharp). It exports `TARGET_WIDTHS`, `LIMITS`, `parseSourcePath`, `mediaKeyFromPath`, `checkSource`, `selectWidths`, `cropBox`, `buildManifest`, and `serializeManifest`. The build script and `edit-layer` share it, so the editor rejects exactly what the build rejects.
- **FR-337** Editor contract (`edit-layer`, `github-publish`): an upload is a binary file committed to `media-src/<slug>/<name>.<ext>`, with content referencing `'<slug>/<name>'`. Before the build exists, the editor reads intrinsic size client-side (`createImageBitmap(file)`), runs `checkSource`, and previews from an object URL. The **build manifest is authoritative**. `content-json`'s validator checks references against `known keys = manifest keys ∪ keys staged in this publish`. Replacing a source with a different extension must delete the old file in the same commit, using `github-publish`'s `put-binary` and `delete` changes. That module's allowlist must use FR-322's extensions; MQ7 covers `.gif`.
- **FR-338** Migration (one time): there are no originals, so the largest committed WebP becomes the source. `public/media/<slug>/cover-1440.webp` → `media-src/<slug>/cover.webp` (`madramps`: `cover-960.webp`), and the clips move to `media-src/merchants/clip.{mp4,webm}`. Every other file under `public/media/` and the committed manifest are removed from git. Passthrough (FR-325) keeps the largest WebP identical. Smaller sizes and AVIF are re-derived from a 1440 px source, so they're downscales, never upscales. Old binaries stay in git history (about 2.5 MB), and history isn't rewritten.
- **FR-339** Content test: this module replaces the "optimized files on disk" and "video in both formats" checks in `tests/unit/content.test.ts` with "every referenced image key has exactly one supported source in `media-src/`, and every video key has both `mp4` and `webm`". The check reads `media-src/` and needs no build. Alt text and reference-in-manifest rules belong to `content-json`'s validator. If that module has already moved them, this module edits only the file check.

## 3. Tech stack

Node ≥ 22.18 (runs `.ts` scripts natively) · sharp 0.35.5 (already an exact-pinned devDependency) · `node:crypto` SHA-256 · a Netlify local build plugin (plain ESM `.js`, no dependencies) · GitHub Actions `actions/cache@v4`. No new dependencies (constitution II.2).

## 4. Commands

```sh
npm run media                                  # validate media-src/, write public/media/ + both manifests
npm run dev                                    # npm run media && vite
npm run build                                  # npm run media && tsc --noEmit && npm run content:check && vite build
npm run check                                  # npm run media && typecheck && lint && test
npm run media:clip -- merchants /path/full.png # local ffmpeg clip → media-src/merchants/clip.{mp4,webm}
npx vitest run tests/unit/media-rules.test.ts tests/unit/build-media.test.ts
rm -rf .cache/media                            # force a cold encode
```

## 5. Project structure

```
media-src/<slug>/<name>.<ext>       committed raw sources (images, clips)
scripts/build-media.ts              I/O entry (git mv of optimize-images.ts): walk, validate, encode, write
scripts/media-cache.ts              content-addressed cache: key, lookup, store, prune
src/core/media-rules.ts             pure, browser-safe rules (FR-336)
netlify/plugins/media-cache/        manifest.yml + index.js (restore/save .cache/media)
public/media/  .cache/media/        generated, gitignored
src/content/{media,video}-manifest.json   generated, gitignored
tests/unit/media-rules.test.ts      pure unit tests
tests/unit/build-media.test.ts      node-env integration on synthetic sharp fixtures
```

## 6. Code style

```ts
export const TARGET_WIDTHS = [480, 960, 1440] as const;

/** Output widths for a source (FR-323): never upscale. */
export function selectWidths(sourceWidth: number): readonly number[] {
  return TARGET_WIDTHS.filter((w) => w <= sourceWidth);
}

/** 'media-src/dmns/cover.webp' → 'dmns/cover' (FR-321). */
export function mediaKeyFromPath(path: string): string | undefined {
  const parsed = parseSourcePath(path);
  return parsed.ok ? `${parsed.slug}/${parsed.name}` : undefined;
}
```

Results are discriminated unions (`{ ok: true, … } | { ok: false, error }`), not thrown errors. Every file stays ≤ 300 lines.

## 7. Testing strategy

- **Unit (`media-rules.test.ts`)**: path parsing (valid, uppercase extension, nesting, dotfile, bad name), key mapping, duplicate-key detection, `checkSource` limits (10 MB, 480 px, 50 MP), `selectWidths` (5120, 1440, 1400, 480, 479), `cropBox` (tall cover cropped, tall gallery image kept, wide unchanged), the passthrough decision, video pairing, and the stable `serializeManifest` order.
- **Integration (`build-media.test.ts`, `// @vitest-environment node`)**: synthetic images from `sharp({ create })` in a temp directory. The first run encodes, and the second reports 0 encodes with identical output hashes. A truncated PNG fails, with its path in the error. Stale outputs are removed. The pipeline function takes `{ srcDir, outDir, cacheDir, manifestDir }`, so tests never touch the real repo.
- **Content (`content.test.ts`)**: the FR-339 source checks.
- **E2E**: unchanged. Playwright's `webServer` runs `npm run build`, which now includes media.

## 8. Boundaries

- **Always**: run media before validation, `tsc`, and `vite`. Name the failing file. Keep `media-rules.ts` free of Node and DOM imports. Treat a cache miss as a re-encode, never as an error.
- **Ask first**: changing widths or quality (re-encodes everything and may move pixels), changing the manifest shape (`image.ts`, `content-json`, and `edit-layer` read it), transcoding video at build, adding any dependency or an npm Netlify plugin, and deleting `media-src/` files beyond the FR-338 migration.
- **Never**: commit `public/media/` or a generated manifest, have the build write into `media-src/`, upscale, make a build depend on the cache, make network calls during `npm run media`, or update a visual baseline (`tests/visual/` is empty today) without the owner's written approval.

## 9. Success criteria

| ID | Measure | Target |
| --- | --- | --- |
| SC-M1 | Added Netlify build time, cold cache (8 covers) | ≤ 60 s (owner-accepted bound) |
| SC-M2 | Added build time, warm cache | ≤ 5 s |
| SC-M3 | Manifest keys and `widths` after migration | identical to the pre-migration file |
| SC-M4 | Hand-dropped image on a deploy preview | live with no step other than the content reference |
| SC-M5 | Public budgets (`check-budgets.ts` measures JS, CSS, and fonts in `dist/`) | unchanged; the script needs no edit |

## 10. Open questions

| # | Question | Default if unanswered |
| --- | --- | --- |
| MQ1 | Do you still have the original cover exports (1920 px or larger, named in 001 research.md)? Dropping them in removes the generational loss and restores today's `width`/`height` values. | Migrate from the 1440 WebP (FR-338) |
| MQ2 | FR-030 lists a 1920 w size, but the pipeline emits up to 1440 as today. Add 1920 for sources at least that wide? | No: keep 3 widths |
| MQ3 | Should a source that no content references fail the build, warn, or pass? (`content-json` would own the check.) | Warn |
| MQ4 | Do you want a dev watch mode (re-run on `media-src` changes)? | Not in v1 |
| MQ5 | The Netlify plugin API (`utils.cache.restore/save`, ESM local plugins) is high confidence but has to be checked against Netlify docs in T327. | Verify, then build |
| MQ6 | `content-json`: add a video-key rule that reads `video-manifest.json` keys (FR-329)? | Yes, coordinated with that module |
| MQ7 | `github-publish` allows `.gif` uploads, but this pipeline rejects GIF (motion belongs in a clip). Drop `.gif` from that allowlist? | Yes: drop it |

## Implementation notes

- FR-322: "MB" is binary (10 × 1024² and 1.5 × 1024² bytes); `github-publish` should use the same constant (`LIMITS.maxImageBytes`).
- FR-336: `checkSource(source, { bytes, width?, height? })` returns `{ ok: false, errors: string[] }` (one line per problem) rather than a single `error`; `parseSourcePath` failures carry `ignored: true` for dotfiles.
- FR-325: passthrough also requires no EXIF reorientation, and a source whose decoded format doesn't match its extension (a PNG named `.webp`) is rejected, so passthrough can never ship the wrong bytes.
- FR-331: until `content-json` lands, `build` is `npm run media && tsc --noEmit && vite build`; `content:check` slots in after `tsc` at merge.
- FR-333: the plugin folder also holds a dependency-free `package.json` with `"type": "module"` (Netlify's docs require it for ESM plugins). ESM loading and the cache `cwd` are still TO VERIFY on a deploy preview.
- FR-333: the CI cache key also hashes `scripts/media-cache.ts`, and an OS-prefix `restore-keys` allows partial hits (entries are content-addressed, so that's safe).
- T329 (deploy-preview evidence) needs a pushed branch and was not run here. Local timings on Apple silicon: cold about 2.7 s, warm about 0.1 s for 8 covers.
