// Usage: node scripts/optimize-images.ts <source-dir>
// Each source file is named <slug>.<ext>. Writes public/media/<slug>/cover-<w>.{avif,webp}
// and merges entries into src/content/media-manifest.json (FR-030).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';

interface ManifestEntry {
  width: number;
  height: number;
  widths: number[];
}

const WIDTHS = [480, 960, 1440];
const MAX_ASPECT = 16 / 10; // full-page screenshots are cropped from the top to 16:10
const MANIFEST = 'src/content/media-manifest.json';

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error('Usage: node scripts/optimize-images.ts <source-dir>');
  process.exit(1);
}

const manifest: Record<string, ManifestEntry> = existsSync(MANIFEST)
  ? (JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, ManifestEntry>)
  : {};

for (const file of readdirSync(sourceDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))) {
  const slug = basename(file, extname(file));
  const input = sharp(join(sourceDir, file));
  const meta = await input.metadata();
  const srcWidth = meta.width;
  const srcHeight = Math.min(meta.height, Math.round(srcWidth / MAX_ASPECT));
  const cropped = input.extract({ left: 0, top: 0, width: srcWidth, height: srcHeight });
  const base = await cropped.toBuffer();

  const outDir = join('public/media', slug);
  mkdirSync(outDir, { recursive: true });
  const widths = WIDTHS.filter((w) => w <= srcWidth);
  for (const w of widths) {
    const resized = sharp(base).resize({ width: w });
    await resized
      .clone()
      .avif({ quality: 50 })
      .toFile(join(outDir, `cover-${w}.avif`));
    await resized
      .clone()
      .webp({ quality: 72 })
      .toFile(join(outDir, `cover-${w}.webp`));
  }
  manifest[`${slug}/cover`] = { width: srcWidth, height: srcHeight, widths };
  console.log(`${slug}: ${srcWidth}×${srcHeight} → ${widths.join(', ')}`);
}

mkdirSync('src/content', { recursive: true });
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
