// Media pipeline rules (spec 004 media-pipeline, FR-320–FR-329, FR-336).
// Pure and browser-safe: no Node or DOM imports. The build script and the editor share this
// file, so the editor rejects exactly what the build rejects.

export const SOURCE_ROOT = 'media-src';
export const TARGET_WIDTHS = [480, 960, 1440] as const;
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif'] as const;
export const VIDEO_EXTENSIONS = ['mp4', 'webm'] as const;

export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];
export type VideoExtension = (typeof VIDEO_EXTENSIONS)[number];
export type OutputFormat = 'avif' | 'webp';

const MB = 1024 * 1024;

/** FR-322 limits. Byte sizes use binary megabytes. */
export const LIMITS = {
  maxImageBytes: 10 * MB,
  minImageWidth: TARGET_WIDTHS[0],
  maxImagePixels: 50_000_000,
  maxVideoBytes: 1.5 * MB,
} as const;

const SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface SourceBase {
  /** Repo-relative path, e.g. 'media-src/dmns/cover.webp'. */
  readonly path: string;
  readonly slug: string;
  readonly name: string;
  /** Manifest key, '<slug>/<name>' (FR-321). */
  readonly key: string;
}

export interface ImageSource extends SourceBase {
  readonly kind: 'image';
  readonly ext: ImageExtension;
}

export interface VideoSource extends SourceBase {
  readonly kind: 'video';
  readonly ext: VideoExtension;
}

export type SourceRef = ImageSource | VideoSource;

export type ParsedSource =
  | ({ readonly ok: true } & SourceRef)
  | { readonly ok: false; readonly ignored: boolean; readonly error: string };

const isImageExt = (ext: string): ext is ImageExtension =>
  (IMAGE_EXTENSIONS as readonly string[]).includes(ext);
const isVideoExt = (ext: string): ext is VideoExtension =>
  (VIDEO_EXTENSIONS as readonly string[]).includes(ext);

const fail = (path: string, reason: string): ParsedSource => ({
  ok: false,
  ignored: false,
  error: `${path}: ${reason}`,
});

/** Parses 'media-src/<slug>/<name>.<ext>' (FR-320, FR-322). Dotfiles come back `ignored`. */
export function parseSourcePath(path: string): ParsedSource {
  const segments = path.split('/');
  const root = segments[0];
  const rest = segments.slice(1);
  if (rest.some((s) => s.startsWith('.'))) {
    return { ok: false, ignored: true, error: `${path}: dotfile, ignored` };
  }
  if (root !== SOURCE_ROOT || rest.length === 0) {
    return fail(path, `must be under ${SOURCE_ROOT}/`);
  }
  if (rest.length === 1) return fail(path, 'must be inside a <slug>/ folder');
  if (rest.length > 2) return fail(path, 'nested too deep, use <slug>/<name>.<ext>');
  const [slug = '', file = ''] = rest;
  if (!SEGMENT.test(slug)) return fail(path, `folder "${slug}" must be lowercase kebab-case`);
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return fail(path, 'missing file extension');
  const name = file.slice(0, dot);
  const ext = file.slice(dot + 1);
  if (!SEGMENT.test(name)) return fail(path, `name "${name}" must be lowercase kebab-case`);
  if (ext !== ext.toLowerCase()) return fail(path, `extension .${ext} must be lowercase`);
  const key = `${slug}/${name}`;
  if (isImageExt(ext)) return { ok: true, kind: 'image', path, slug, name, ext, key };
  if (isVideoExt(ext)) return { ok: true, kind: 'video', path, slug, name, ext, key };
  return fail(
    path,
    `unsupported extension .${ext} (allowed: ${[...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS].join(', ')})`,
  );
}

/** 'media-src/dmns/cover.webp' → 'dmns/cover' (FR-321). */
export function mediaKeyFromPath(path: string): string | undefined {
  const parsed = parseSourcePath(path);
  return parsed.ok ? parsed.key : undefined;
}

/** Two image sources with one key (cover.png + cover.webp) are an error (FR-321). */
export function findDuplicateKeys(sources: readonly SourceRef[]): readonly string[] {
  const byKey = new Map<string, ImageSource[]>();
  for (const s of sources) {
    if (s.kind !== 'image') continue;
    byKey.set(s.key, [...(byKey.get(s.key) ?? []), s]);
  }
  const errors: string[] = [];
  for (const [key, group] of byKey) {
    if (group.length < 2) continue;
    const files = group.map((s) => `${s.name}.${s.ext}`).join(', ');
    for (const s of group) errors.push(`${s.path}: duplicate key ${key} (${files})`);
  }
  return errors;
}

/** Facts about one source: byte size, plus intrinsic size for images. */
export interface SourceFacts {
  readonly bytes: number;
  readonly width?: number;
  readonly height?: number;
}

export type CheckResult =
  { readonly ok: true } | { readonly ok: false; readonly errors: readonly string[] };

const mb = (bytes: number): string => `${(bytes / MB).toFixed(1)} MB`;

/** FR-322 limits for one source. Every problem becomes one '<path>: <reason>' line. */
export function checkSource(source: SourceRef, facts: SourceFacts): CheckResult {
  const errors: string[] = [];
  const at = (reason: string): void => {
    errors.push(`${source.path}: ${reason}`);
  };
  if (source.kind === 'video') {
    if (facts.bytes > LIMITS.maxVideoBytes) {
      at(`${mb(facts.bytes)}, maximum for a clip is ${mb(LIMITS.maxVideoBytes)}`);
    }
  } else {
    if (facts.bytes > LIMITS.maxImageBytes) {
      at(`${mb(facts.bytes)}, maximum is ${mb(LIMITS.maxImageBytes)}`);
    }
    const { width, height } = facts;
    if (width === undefined || height === undefined) {
      at('could not read the image size');
    } else {
      if (width < LIMITS.minImageWidth) {
        at(`${width} px wide, minimum is ${LIMITS.minImageWidth}`);
      }
      if (width * height > LIMITS.maxImagePixels) {
        const mp = ((width * height) / 1e6).toFixed(1);
        at(`${mp} MP decoded, maximum is ${LIMITS.maxImagePixels / 1e6} MP`);
      }
    }
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** Output widths for a source (FR-323): never upscale. */
export function selectWidths(sourceWidth: number): readonly number[] {
  return TARGET_WIDTHS.filter((w) => w <= sourceWidth);
}

export interface CropBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly cropped: boolean;
}

/** Sources named `cover` taller than 16:10 are cropped from the top (FR-324). */
export const COVER_NAME = 'cover';
export const COVER_ASPECT = 16 / 10;

/** The region kept from an (already auto-oriented) image (FR-324). */
export function cropBox(name: string, width: number, height: number): CropBox {
  const maxHeight = Math.round(width / COVER_ASPECT);
  if (name === COVER_NAME && height > maxHeight) {
    return { left: 0, top: 0, width, height: maxHeight, cropped: true };
  }
  return { left: 0, top: 0, width, height, cropped: false };
}

export interface PassthroughInput {
  readonly ext: ImageExtension;
  readonly format: OutputFormat;
  readonly cropped: boolean;
  /** True when EXIF orientation would rotate or flip the pixels. */
  readonly reoriented: boolean;
  readonly sourceWidth: number;
  readonly targetWidth: number;
}

/** Copy the source byte for byte instead of re-encoding it (FR-325). */
export function shouldPassthrough(input: PassthroughInput): boolean {
  return (
    input.ext === input.format &&
    !input.cropped &&
    !input.reoriented &&
    input.sourceWidth === input.targetWidth
  );
}

export interface VideoPairing {
  readonly keys: readonly string[];
  readonly errors: readonly string[];
}

/** UTF-16 code-unit order, independent of locale (FR-328, FR-334). */
export function byCodeUnit(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Every clip key needs both mp4 and webm (FR-322). */
export function pairVideos(sources: readonly SourceRef[]): VideoPairing {
  const byKey = new Map<string, VideoSource[]>();
  for (const s of sources) {
    if (s.kind !== 'video') continue;
    byKey.set(s.key, [...(byKey.get(s.key) ?? []), s]);
  }
  const keys: string[] = [];
  const errors: string[] = [];
  for (const [key, group] of byKey) {
    const missing = VIDEO_EXTENSIONS.filter((ext) => !group.some((s) => s.ext === ext));
    const first = group[0];
    if (missing.length === 0) keys.push(key);
    else if (first) {
      const files = missing.map((ext) => `${first.name}.${ext}`).join(', ');
      errors.push(`${first.path}: missing ${files} (clips need both mp4 and webm)`);
    }
  }
  return { keys: keys.sort(byCodeUnit), errors };
}

/** One image entry in media-manifest.json (FR-328). */
export interface ImageManifestEntry {
  readonly width: number;
  readonly height: number;
  readonly widths: readonly number[];
  /** Source file name with its extension, e.g. 'cover.webp'. */
  readonly source: string;
}

export type ImageManifest = Readonly<Record<string, ImageManifestEntry>>;
export type VideoManifest = Readonly<
  Record<string, { readonly formats: readonly VideoExtension[] }>
>;

export interface ImageManifestInput extends ImageManifestEntry {
  readonly key: string;
}

/** Image manifest: keys in code-unit order, widths ascending (FR-328). */
export function buildManifest(entries: readonly ImageManifestInput[]): ImageManifest {
  const sorted = [...entries].sort((a, b) => byCodeUnit(a.key, b.key));
  return Object.fromEntries(
    sorted.map((e) => [
      e.key,
      {
        width: e.width,
        height: e.height,
        widths: [...e.widths].sort((a, b) => a - b),
        source: e.source,
      },
    ]),
  );
}

/** video-manifest.json from paired clip keys (FR-329). */
export function buildVideoManifest(keys: readonly string[]): VideoManifest {
  const sorted = [...keys].sort(byCodeUnit);
  return Object.fromEntries(sorted.map((k) => [k, { formats: [...VIDEO_EXTENSIONS] }]));
}

/** Stable bytes: code-unit key order, 2-space JSON, trailing newline (FR-328, FR-334). */
export function serializeManifest(manifest: ImageManifest | VideoManifest): string {
  const keys = Object.keys(manifest).sort(byCodeUnit);
  const ordered = Object.fromEntries(keys.map((k) => [k, manifest[k]]));
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
