// Content-addressed cache for encoded media (spec 004 media-pipeline, FR-332, FR-334).
// Each entry is .cache/media/<key>/ holding '<w>.<fmt>' outputs plus meta.json. The cache is
// never required: any missing, unreadable, or mismatched entry is a miss and re-encodes.
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Bump whenever pipeline behavior changes, so every entry becomes a miss. */
export const PIPELINE_VERSION = 1;

/** One cached output, named '<w>.<fmt>' (for example '960.webp'). */
export interface CacheFile {
  readonly name: string;
  readonly data: Buffer;
}

export interface CacheKeyInput {
  readonly bytes: Buffer;
  /** The FR-324 name rule that applied: cover crop or not. */
  readonly cropRule: 'cover-16:10' | 'keep';
  readonly encoder: unknown;
  /** `sharp.versions`: sharp, libvips, and codec versions. */
  readonly versions: Readonly<Record<string, string | undefined>>;
}

interface MetaFile {
  readonly name: string;
  readonly bytes: number;
  readonly sha256: string;
}

interface Meta {
  readonly key: string;
  readonly version: number;
  readonly files: readonly MetaFile[];
}

const sha256 = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex');

/** SHA-256 over the source bytes, name rule, encoder options, version, and sharp versions. */
export function cacheKey(input: CacheKeyInput): string {
  const versions = Object.fromEntries(
    Object.entries(input.versions).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  return sha256(
    JSON.stringify({
      source: sha256(input.bytes),
      cropRule: input.cropRule,
      encoder: input.encoder,
      pipeline: PIPELINE_VERSION,
      versions,
    }),
  );
}

const isMeta = (value: unknown): value is Meta => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<Meta>;
  return (
    typeof v.key === 'string' &&
    typeof v.version === 'number' &&
    Array.isArray(v.files) &&
    v.files.every(
      (f: Partial<MetaFile>) =>
        typeof f.name === 'string' && typeof f.bytes === 'number' && typeof f.sha256 === 'string',
    )
  );
};

/** Returns the cached files for `key` if every expected file is present and intact. */
export async function lookup(
  cacheDir: string,
  key: string,
  expected: readonly string[],
): Promise<CacheFile[] | undefined> {
  const dir = join(cacheDir, key);
  try {
    const meta: unknown = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8'));
    if (!isMeta(meta) || meta.key !== key || meta.version !== PIPELINE_VERSION) return undefined;
    const names = meta.files.map((f) => f.name).sort();
    if (names.join('\n') !== [...expected].sort().join('\n')) return undefined;
    const files: CacheFile[] = [];
    for (const f of meta.files) {
      const data = await readFile(join(dir, f.name));
      if (data.length !== f.bytes || sha256(data) !== f.sha256) return undefined;
      files.push({ name: f.name, data });
    }
    return files;
  } catch {
    return undefined;
  }
}

/** Stores an entry. meta.json is written last, so a partial entry reads as a miss. */
export async function store(
  cacheDir: string,
  key: string,
  files: readonly CacheFile[],
): Promise<void> {
  const dir = join(cacheDir, key);
  try {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    for (const f of files) await writeFile(join(dir, f.name), f.data);
    const meta: Meta = {
      key,
      version: PIPELINE_VERSION,
      files: files.map((f) => ({ name: f.name, bytes: f.data.length, sha256: sha256(f.data) })),
    };
    const tmp = join(dir, `meta.json.${String(process.pid)}.tmp`);
    await writeFile(tmp, `${JSON.stringify(meta, null, 2)}\n`);
    await rename(tmp, join(dir, 'meta.json'));
  } catch (error) {
    console.warn(`media cache: could not store ${key} (${String(error)})`);
  }
}

/** Removes every entry this run didn't use. Returns how many were removed. */
export async function prune(cacheDir: string, used: ReadonlySet<string>): Promise<number> {
  let removed = 0;
  for (const entry of await readdir(cacheDir, { withFileTypes: true }).catch(() => [])) {
    if (used.has(entry.name)) continue;
    await rm(join(cacheDir, entry.name), { recursive: true, force: true }).catch(() => undefined);
    removed += 1;
  }
  return removed;
}
