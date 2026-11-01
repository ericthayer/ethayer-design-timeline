// Editor media rules (spec 004 edit-layer FR-392, FR-394): upload naming, staged paths and keys,
// the referenced-key walk, and the delete paths for media no project uses any more. Pure.
import {
  IMAGE_EXTENSIONS,
  type ImageManifest,
  SOURCE_ROOT,
  VIDEO_EXTENSIONS,
  mediaKeyFromPath,
} from '../media-rules.ts';
import { isRecord, isString } from '../../content/validate/read.ts';

/** Card media names (FR-389). They keep media-pipeline's cover crop rule (FR-324). */
export const CARD_NAMES = ['cover', 'clip', 'poster'] as const;
export type CardName = (typeof CARD_NAMES)[number];

const isCardName = (name: string): name is CardName =>
  (CARD_NAMES as readonly string[]).includes(name);

/** The lowercase extension of a file name, without the dot, or `''`. */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/** `My Shot.PNG` → `my-shot`. Falls back to `image` when nothing usable is left. */
export function kebabName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot >= 0 ? fileName.slice(0, dot) : fileName;
  const kebab = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return kebab === '' ? 'image' : kebab;
}

/**
 * The media name for an upload. A card upload takes its reserved name. Any other upload uses its
 * kebab basename, with `-2`, `-3`, … added when the key is taken or the name is reserved.
 */
export function uploadName(
  fileName: string,
  slug: string,
  taken: ReadonlySet<string>,
  card: CardName | null = null,
): string {
  if (card !== null) return card;
  const base = kebabName(fileName);
  const free = (name: string): boolean => !isCardName(name) && !taken.has(`${slug}/${name}`);
  if (free(base)) return base;
  let n = 2;
  while (!free(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export interface StagedTarget {
  readonly path: string;
  readonly key: string;
}

/** `media-src/<slug>/<name>.<ext>` and its manifest key, or null when the pipeline would refuse it. */
export function stagedTarget(slug: string, name: string, ext: string): StagedTarget | null {
  const path = `${SOURCE_ROOT}/${slug}/${name}.${ext.toLowerCase()}`;
  const key = mediaKeyFromPath(path);
  return key === undefined ? null : { path, key };
}

/** Where an upload goes: name, path, and key in one step (FR-392). */
export function uploadTarget(
  fileName: string,
  slug: string,
  taken: ReadonlySet<string>,
  card: CardName | null = null,
): StagedTarget | null {
  return stagedTarget(slug, uploadName(fileName, slug, taken, card), extensionOf(fileName));
}

// ---- Referenced keys ----

/**
 * Every manifest key the content uses: the `src` of image and video media at any depth (cards,
 * posters, gallery tiles), and the résumé intro clip (`src` beside `captions`).
 */
export function referencedKeys(values: Iterable<unknown>): Set<string> {
  const keys = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!isRecord(value)) return;
    const { kind, src, captions } = value;
    if (isString(src) && (kind === 'image' || kind === 'video' || isString(captions))) {
      keys.add(src);
    }
    for (const child of Object.values(value)) walk(child);
  };
  for (const value of values) walk(value);
  return keys;
}

// ---- Deletes ----

/**
 * The repo paths to delete for a key. An image with a manifest `source` deletes exactly that file
 * (media-pipeline FR-328, owner decision D4). Otherwise every extension the pipeline accepts is a
 * candidate, and github-publish drops deletes of missing files (FR-366). Paths in `puts` are left out.
 */
export function deletePaths(
  key: string,
  kind: 'image' | 'video',
  puts: ReadonlySet<string>,
  source: string | null = null,
): string[] {
  const slug = key.slice(0, key.indexOf('/'));
  const exts = kind === 'video' ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS;
  const paths =
    kind === 'image' && source !== null
      ? [`${SOURCE_ROOT}/${slug}/${source}`]
      : exts.map((ext) => `${SOURCE_ROOT}/${key}.${ext}`);
  return paths.filter((path) => !puts.has(path));
}

export interface MediaDeleteInput {
  /** Keys the edited project referenced at the base sha. */
  readonly before: ReadonlySet<string>;
  /** Keys the whole bundle references after the change (every project, résumé, site). */
  readonly after: ReadonlySet<string>;
  readonly images: ImageManifest;
  readonly videoKeys: ReadonlySet<string>;
  /** Paths the same publish writes. */
  readonly puts: ReadonlySet<string>;
}

/** Delete paths for keys the edit stopped using and nothing else still references (FR-392). */
export function mediaDeletes(input: MediaDeleteInput): string[] {
  const paths: string[] = [];
  for (const key of [...input.before].sort()) {
    if (input.after.has(key)) continue;
    const image = input.images[key];
    if (image !== undefined) paths.push(...deletePaths(key, 'image', input.puts, image.source));
    else if (input.videoKeys.has(key)) paths.push(...deletePaths(key, 'video', input.puts));
  }
  return paths;
}
