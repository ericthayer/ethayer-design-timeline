// Reads the content files and the validation facts from disk (spec 004 content-json, FR-310).
// Shared by `check-content.ts` and the unit tests. The validator itself never touches `node:*`.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_FILES, PROJECTS_DIR } from '../src/content/paths.ts';
import {
  type RawContent,
  type ValidationContext,
  parseJson,
} from '../src/content/validate/index.ts';
import { isRecord } from '../src/content/validate/read.ts';

export const MEDIA_MANIFEST = 'src/content/media-manifest.json';
export const VIDEO_MANIFEST = 'src/content/video-manifest.json';
export const NETLIFY_TOML = 'netlify.toml';

const readText = (root: string, file: string): string => readFileSync(join(root, file), 'utf8');

/** Every project file plus the four documents, parsed, keyed by repo path. Missing files are left out. */
export function readRawContent(root: string): RawContent {
  const raw: Record<string, unknown> = {};
  const dir = join(root, PROJECTS_DIR);
  const names = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.json')) : [];
  for (const name of names.sort()) {
    const file = `${PROJECTS_DIR}/${name}`;
    raw[file] = parseJson(readText(root, file));
  }
  for (const file of Object.values(CONTENT_FILES)) {
    if (existsSync(join(root, file))) raw[file] = parseJson(readText(root, file));
  }
  return raw;
}

/** The keys of a manifest, or `null` when the file does not exist (skips that check). */
function manifestKeys(root: string, file: string): ReadonlySet<string> | null {
  if (!existsSync(join(root, file))) return null;
  const json = parseJson(readText(root, file));
  return new Set(isRecord(json) ? Object.keys(json) : []);
}

/** The origins in the CSP `frame-src` directive. */
export function frameOrigins(toml: string): string[] {
  return /frame-src ([^;"]+)/.exec(toml)?.[1]?.trim().split(/\s+/) ?? [];
}

/** Manifest keys and CSP frame origins, the facts the validator takes as input (FR-305). */
export function readContext(root: string): ValidationContext {
  const toml = existsSync(join(root, NETLIFY_TOML)) ? readText(root, NETLIFY_TOML) : '';
  return {
    mediaKeys: manifestKeys(root, MEDIA_MANIFEST),
    videoKeys: manifestKeys(root, VIDEO_MANIFEST),
    frameOrigins: frameOrigins(toml),
  };
}
