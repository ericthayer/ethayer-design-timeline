// Usage: npm run og [-- <slug> ...]
// Renders the 1200 × 630 link-preview posters (FR-106): starts a Vite dev server, screenshots
// tools/og-card.html with Playwright for every card, shrinks each PNG with sharp, and records
// an input hash per card in src/content/og-manifest.json so `npm test` can spot stale images.
// Commit the results; the Netlify build has no browser.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { createServer } from 'vite';
import { OG_SIZE, ogCards, ogHash } from '../src/content/og.ts';
import { PROJECTS } from '../src/content/projects/index.ts';
import { ogTemplateHash, type OgManifest } from './lib/og-template.ts';

const OUT_DIR = 'public/og';
const MANIFEST = 'src/content/og-manifest.json';

const cards = ogCards(PROJECTS);
const only = new Set(process.argv.slice(2));
const unknown = [...only].filter((slug) => !cards.some((card) => card.slug === slug));
if (unknown.length > 0) {
  console.error(`Unknown slug: ${unknown.join(', ')}`);
  process.exit(1);
}
const todo = cards.filter((card) => only.size === 0 || only.has(card.slug));

mkdirSync(OUT_DIR, { recursive: true });
const previous = JSON.parse(readFileSync(MANIFEST, 'utf8').trim() || '{}') as Partial<OgManifest>;
const template = ogTemplateHash();
// A changed template makes every image stale, so a partial run can't certify the rest.
if (only.size > 0 && previous.template !== template) {
  console.error('The template changed since the last full run. Run `npm run og` without slugs.');
  process.exit(1);
}
const hashes: Record<string, string> = {};
for (const card of cards) hashes[card.slug] = previous.cards?.[card.slug] ?? '';

const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 5199 } });
await server.listen();
const base = server.resolvedUrls?.local[0];
if (!base) throw new Error('Vite dev server did not report a URL');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: OG_SIZE,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce', // stills only: no entry animations in a screenshot
  });
  page.on('pageerror', (error) => {
    throw error;
  });
  for (const card of todo) {
    await page.goto(`${base}tools/og-card.html?slug=${encodeURIComponent(card.slug)}`);
    await page.waitForSelector('html[data-ready]', { timeout: 15_000 });
    const shot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, ...OG_SIZE } });
    const png = await sharp(shot).png({ palette: true, quality: 90, effort: 10 }).toBuffer();
    writeFileSync(join(OUT_DIR, `${card.slug}.png`), png);
    hashes[card.slug] = ogHash(card);
    console.log(`${card.slug.padEnd(28)} ${(png.length / 1024).toFixed(0).padStart(4)} KB`);
  }
} finally {
  await browser.close();
  await server.close();
}

// Drop images for projects that no longer exist.
const wanted = new Set(cards.map((card) => `${card.slug}.png`));
for (const file of readdirSync(OUT_DIR)) {
  if (file.endsWith('.png') && !wanted.has(file)) {
    rmSync(join(OUT_DIR, file));
    console.log(`removed orphan ${file}`);
  }
}
const manifest: OgManifest = { template, cards: hashes };
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
