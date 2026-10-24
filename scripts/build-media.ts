// Usage: node scripts/build-media.ts   (npm run media)
// Validates every source under media-src/<slug>/<name>.<ext>, then writes public/media/ and
// src/content/{media,video}-manifest.json (spec 004 media-pipeline, FR-320–FR-335).
// Nothing is written unless every source passes. Errors print one per line as '<path>: <reason>'.
import { mkdir, readFile, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import {
  LIMITS,
  SOURCE_ROOT,
  buildManifest,
  buildVideoManifest,
  checkSource,
  cropBox,
  findDuplicateKeys,
  pairVideos,
  parseSourcePath,
  selectWidths,
  serializeManifest,
  shouldPassthrough,
  type CropBox,
  type ImageExtension,
  type ImageManifestInput,
  type ImageSource,
  type OutputFormat,
  type SourceRef,
} from '../src/core/media-rules.ts';

export interface PipelineDirs {
  readonly srcDir: string;
  readonly outDir: string;
  readonly cacheDir: string;
  readonly manifestDir: string;
}

export interface PipelineReport {
  readonly images: number;
  readonly encoded: number;
  readonly cached: number;
  /** Clip files passed through byte for byte (FR-326). */
  readonly copied: number;
  /** Stale files removed from the output directory (FR-330). */
  readonly removed: number;
  readonly errors: readonly string[];
}

/** FR-325 encoder options. Changing them re-encodes everything (Ask first). */
export const ENCODER = {
  avif: { quality: 50, effort: 4 },
  webp: { quality: 72, effort: 4 },
} as const;
const FORMATS: readonly OutputFormat[] = ['avif', 'webp'];

/** What sharp reports for each source extension, so a renamed file can't pass through. */
const DECODED_AS: Readonly<Record<ImageExtension, readonly string[]>> = {
  jpg: ['jpeg'],
  jpeg: ['jpeg'],
  png: ['png'],
  webp: ['webp'],
  avif: ['heif', 'avif'],
};

export interface PreparedImage {
  readonly source: ImageSource;
  readonly bytes: Buffer;
  /** Size after auto-orientation and crop: the manifest's width and height. */
  readonly crop: CropBox;
  readonly reoriented: boolean;
  readonly widths: readonly number[];
}

/** One generated file, relative to the output directory: '<slug>/<name>-<w>.<fmt>'. */
export interface OutputFile {
  readonly rel: string;
  readonly data: Buffer;
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Every file below `dir` as a '/'-joined relative path. Dot-directories are skipped. */
async function walk(dir: string, prefix = ''): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(join(dir, prefix), { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.')) files.push(...(await walk(dir, rel)));
    } else files.push(rel);
  }
  return files.sort();
}

/** Reads size and orientation without decoding pixels, then applies FR-322 limits. */
async function prepareImage(
  source: ImageSource,
  bytes: Buffer,
): Promise<PreparedImage | readonly string[]> {
  let meta;
  try {
    meta = await sharp(bytes).metadata();
  } catch (error) {
    return [`${source.path}: unreadable image (${message(error)})`];
  }
  if (!DECODED_AS[source.ext].includes(meta.format)) {
    return [`${source.path}: contents are ${meta.format}, not ${source.ext}`];
  }
  const { width, height } = meta.autoOrient;
  const check = checkSource(source, { bytes: bytes.length, width, height });
  if (!check.ok) return check.errors;
  const crop = cropBox(source.name, width, height);
  const reoriented = (meta.orientation ?? 1) > 1;
  return { source, bytes, crop, reoriented, widths: selectWidths(crop.width) };
}

/** Encodes one source at every selected width in both formats, or passes it through (FR-325). */
export async function encodeImage(image: PreparedImage): Promise<OutputFile[]> {
  const { source, bytes, crop, reoriented, widths } = image;
  const jobs = widths.flatMap((w) =>
    FORMATS.map(async (format): Promise<OutputFile> => {
      const rel = `${source.slug}/${source.name}-${w}.${format}`;
      const passthrough = shouldPassthrough({
        ext: source.ext,
        format,
        cropped: crop.cropped,
        reoriented,
        sourceWidth: crop.width,
        targetWidth: w,
      });
      if (passthrough) return { rel, data: bytes };
      let pipeline = sharp(bytes, { autoOrient: true, limitInputPixels: LIMITS.maxImagePixels });
      if (crop.cropped) pipeline = pipeline.extract(crop);
      if (w !== crop.width) pipeline = pipeline.resize({ width: w });
      pipeline = format === 'avif' ? pipeline.avif(ENCODER.avif) : pipeline.webp(ENCODER.webp);
      return { rel, data: await pipeline.toBuffer() };
    }),
  );
  return Promise.all(jobs);
}

/** Writes `text` via a temp file + rename, and skips the write when nothing changed (FR-327). */
async function writeAtomic(file: string, text: string): Promise<void> {
  const current = await readFile(file, 'utf8').catch(() => undefined);
  if (current === text) return;
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${String(process.pid)}.tmp`;
  await writeFile(tmp, text);
  await rename(tmp, file);
}

/** Makes `outDir` hold exactly `files`: unchanged files stay, stale ones go (FR-330). */
async function syncOutputs(outDir: string, files: ReadonlyMap<string, Buffer>): Promise<number> {
  for (const [rel, data] of files) {
    const dest = join(outDir, rel);
    const current = await readFile(dest).catch(() => undefined);
    if (current?.equals(data)) continue;
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, data);
  }
  let removed = 0;
  for (const rel of await walk(outDir)) {
    if (files.has(rel)) continue;
    await rm(join(outDir, rel), { force: true });
    removed += 1;
  }
  for (const entry of await readdir(outDir, { withFileTypes: true }).catch(() => [])) {
    if (entry.isDirectory()) await rmdir(join(outDir, entry.name)).catch(() => undefined);
  }
  return removed;
}

/** Validates everything, then encodes, then writes outputs and manifests (FR-326–FR-330). */
export async function runMediaPipeline(dirs: PipelineDirs): Promise<PipelineReport> {
  const errors: string[] = [];
  const sources: SourceRef[] = [];
  for (const rel of await walk(dirs.srcDir)) {
    const parsed = parseSourcePath(`${SOURCE_ROOT}/${rel}`);
    if (parsed.ok) sources.push(parsed);
    else if (!parsed.ignored) errors.push(parsed.error);
  }
  errors.push(...findDuplicateKeys(sources));
  const videos = pairVideos(sources);
  errors.push(...videos.errors);

  const images: PreparedImage[] = [];
  const outputs = new Map<string, Buffer>();
  for (const source of sources) {
    const bytes = await readFile(join(dirs.srcDir, source.path.slice(SOURCE_ROOT.length + 1)));
    if (source.kind === 'video') {
      const check = checkSource(source, { bytes: bytes.length });
      if (check.ok) outputs.set(`${source.slug}/${source.name}.${source.ext}`, bytes);
      else errors.push(...check.errors);
      continue;
    }
    const prepared = await prepareImage(source, bytes);
    if ('source' in prepared) images.push(prepared);
    else errors.push(...prepared);
  }
  const fail = (all: readonly string[]): PipelineReport => ({
    images: images.length,
    encoded: 0,
    cached: 0,
    copied: 0,
    removed: 0,
    errors: all,
  });
  if (errors.length > 0) return fail(errors);

  const copied = outputs.size;
  let encoded = 0;
  for (const image of images) {
    try {
      for (const file of await encodeImage(image)) outputs.set(file.rel, file.data);
      encoded += 1;
    } catch (error) {
      errors.push(`${image.source.path}: could not decode (${message(error)})`);
    }
  }
  if (errors.length > 0) return fail(errors);

  const removed = await syncOutputs(dirs.outDir, outputs);
  const entries: ImageManifestInput[] = images.map(({ source, crop, widths }) => ({
    key: source.key,
    width: crop.width,
    height: crop.height,
    widths,
    source: `${source.name}.${source.ext}`,
  }));
  await writeAtomic(
    join(dirs.manifestDir, 'media-manifest.json'),
    serializeManifest(buildManifest(entries)),
  );
  await writeAtomic(
    join(dirs.manifestDir, 'video-manifest.json'),
    serializeManifest(buildVideoManifest(videos.keys)),
  );
  return { images: images.length, encoded, cached: 0, copied, removed, errors: [] };
}

const root = fileURLToPath(new URL('..', import.meta.url));
export const REPO_DIRS: PipelineDirs = {
  srcDir: join(root, SOURCE_ROOT),
  outDir: join(root, 'public/media'),
  cacheDir: join(root, '.cache/media'),
  manifestDir: join(root, 'src/content'),
};

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const started = performance.now();
  const report = await runMediaPipeline(REPO_DIRS);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  if (report.errors.length > 0) {
    for (const line of report.errors) console.error(line);
    console.error(`media: ${String(report.errors.length)} problem(s), nothing written`);
    process.exitCode = 1;
  } else {
    console.log(
      `media: ${String(report.images)} images (encoded: ${String(report.encoded)}, ` +
        `cached: ${String(report.cached)}), ${String(report.copied)} clip files copied, ` +
        `${String(report.removed)} stale removed in ${seconds} s`,
    );
  }
}
