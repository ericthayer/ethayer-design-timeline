/**
 * Fingerprint of everything that shapes a link-preview image besides the card data (FR-136):
 * the palette, font, poster template, artwork generators, and hero art. When any of these change,
 * the committed images are stale even though no project did. Erasable TypeScript only.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FILES = [
  'src/styles/tokens.css',
  'src/styles/fonts.css',
  'public/fonts/hanken-grotesk-latin-wght.woff2',
  'tools/og-card.html',
  'tools/og-card.css',
  'tools/og-card.ts',
  'src/content/og.ts',
  'src/components/site-hero/site-hero.css',
  'src/components/site-hero/site-hero.ts',
  'src/core/cascade.ts',
  'src/core/dom.ts',
  'src/core/format.ts',
  'src/core/rng.ts',
];
const DIRECTORIES = ['src/components/swiss-artwork'];

function templatePaths(root: string): string[] {
  const fromDirectories = DIRECTORIES.flatMap((dir) =>
    readdirSync(join(root, dir)).map((name) => `${dir}/${name}`),
  );
  return [...FILES, ...fromDirectories].sort();
}

/** 12 hex digits over every template file's path and bytes. */
export function ogTemplateHash(root = '.'): string {
  const hash = createHash('sha256');
  for (const path of templatePaths(root)) {
    hash.update(`${path}\0`);
    hash.update(readFileSync(join(root, path)));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

export interface OgManifest {
  readonly template: string;
  readonly cards: Readonly<Record<string, string>>;
}
