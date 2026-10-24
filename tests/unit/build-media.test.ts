// @vitest-environment node
// Integration: runMediaPipeline over synthetic sharp fixtures in a temp directory (spec 004 §7).
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runMediaPipeline, type PipelineDirs } from '../../scripts/build-media.ts';

let root = '';
let dirs: PipelineDirs;

const put = (rel: string, data: Buffer | string): void => {
  const file = join(dirs.srcDir, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, data);
};

const image = (width: number, height: number, format: 'png' | 'webp'): Promise<Buffer> => {
  const base = sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 40, b: 90 } },
  });
  return (format === 'png' ? base.png() : base.webp({ quality: 72 })).toBuffer();
};

const manifest = (name: string): unknown =>
  JSON.parse(readFileSync(join(dirs.manifestDir, name), 'utf8'));

/** SHA-256 of every output file, keyed by its path below the output directory. */
const snapshot = (): Record<string, string> => {
  const files = readdirSync(dirs.outDir, { recursive: true, withFileTypes: true }).filter((d) =>
    d.isFile(),
  );
  return Object.fromEntries(
    files.map((d) => {
      const file = join(d.parentPath, d.name);
      const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
      return [file.slice(dirs.outDir.length + 1), hash];
    }),
  );
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'media-pipeline-'));
  dirs = {
    srcDir: join(root, 'media-src'),
    outDir: join(root, 'public/media'),
    cacheDir: join(root, '.cache/media'),
    manifestDir: join(root, 'src/content'),
  };
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('runMediaPipeline', () => {
  it('encodes images, passes clips through, and writes both manifests', async () => {
    put('dmns/cover.png', await image(1600, 2000, 'png'));
    const detail = await image(960, 1200, 'webp');
    put('dmns/detail.webp', detail);
    put('merchants/clip.mp4', 'mp4-bytes');
    put('merchants/clip.webm', 'webm-bytes');
    put('.DS_Store', 'ignored');

    const report = await runMediaPipeline(dirs);
    expect(report.errors).toEqual([]);
    expect(report).toMatchObject({ images: 2, encoded: 2, copied: 2 });

    expect(manifest('media-manifest.json')).toEqual({
      'dmns/cover': { width: 1600, height: 1000, widths: [480, 960, 1440], source: 'cover.png' },
      'dmns/detail': { width: 960, height: 1200, widths: [480, 960], source: 'detail.webp' },
    });
    expect(manifest('video-manifest.json')).toEqual({
      'merchants/clip': { formats: ['mp4', 'webm'] },
    });

    for (const w of [480, 960, 1440]) {
      for (const ext of ['avif', 'webp']) {
        expect(existsSync(join(dirs.outDir, `dmns/cover-${String(w)}.${ext}`))).toBe(true);
      }
    }
    const cover = await sharp(join(dirs.outDir, 'dmns/cover-1440.webp')).metadata();
    expect([cover.width, cover.height]).toEqual([1440, 900]);
    const portrait = await sharp(join(dirs.outDir, 'dmns/detail-480.avif')).metadata();
    expect([portrait.width, portrait.height]).toEqual([480, 600]);
    expect(readFileSync(join(dirs.outDir, 'dmns/detail-960.webp')).equals(detail)).toBe(true);
    expect(readFileSync(join(dirs.outDir, 'merchants/clip.mp4'), 'utf8')).toBe('mp4-bytes');
  });

  it('writes nothing when one source is corrupt, and names the file', async () => {
    put('dmns/cover.webp', await image(1440, 900, 'webp'));
    const png = await image(1200, 750, 'png');
    put('sublist/cover.png', png.subarray(0, Math.floor(png.length / 2)));

    const report = await runMediaPipeline(dirs);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toMatch(/^media-src\/sublist\/cover\.png: /);
    expect(existsSync(dirs.outDir)).toBe(false);
    expect(existsSync(join(dirs.manifestDir, 'media-manifest.json'))).toBe(false);
  });

  it('collects every validation problem before encoding', async () => {
    put('dmns/cover.png', await image(320, 200, 'png'));
    put('dmns/cover.webp', await image(1440, 900, 'webp'));
    put('merchants/clip.mp4', 'mp4-bytes');
    put('Bad/cover.png', 'x');
    put('dmns/notes.txt', 'x');

    const report = await runMediaPipeline(dirs);
    expect(report.encoded).toBe(0);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('media-src/Bad/cover.png: folder "Bad"'),
        expect.stringContaining('media-src/dmns/notes.txt: unsupported extension .txt'),
        expect.stringContaining('media-src/dmns/cover.png: duplicate key dmns/cover'),
        'media-src/dmns/cover.png: 320 px wide, minimum is 480',
        expect.stringContaining('media-src/merchants/clip.mp4: missing clip.webm'),
      ]),
    );
    expect(existsSync(dirs.outDir)).toBe(false);
  });

  it('re-uses the cache: a second run encodes nothing and writes identical bytes', async () => {
    put('dmns/cover.png', await image(1600, 1000, 'png'));
    put('sublist/cover.webp', await image(1440, 810, 'webp'));
    const first = await runMediaPipeline(dirs);
    expect(first).toMatchObject({ encoded: 2, cached: 0, errors: [] });
    const before = snapshot();
    const manifestBefore = readFileSync(join(dirs.manifestDir, 'media-manifest.json'), 'utf8');

    const second = await runMediaPipeline(dirs);
    expect(second).toMatchObject({ encoded: 0, cached: 2, errors: [] });
    expect(snapshot()).toEqual(before);
    expect(readFileSync(join(dirs.manifestDir, 'media-manifest.json'), 'utf8')).toBe(
      manifestBefore,
    );

    const entry = readdirSync(dirs.cacheDir).find((key) =>
      existsSync(join(dirs.cacheDir, key, '1440.avif')),
    );
    expect(entry).toBeDefined();
    rmSync(join(dirs.cacheDir, entry ?? '', '480.webp'));
    const third = await runMediaPipeline(dirs);
    expect(third).toMatchObject({ encoded: 1, cached: 1, errors: [] });

    rmSync(dirs.cacheDir, { recursive: true });
    const cold = await runMediaPipeline(dirs);
    expect(cold).toMatchObject({ encoded: 2, cached: 0, errors: [] });
    expect(readFileSync(join(dirs.manifestDir, 'media-manifest.json'), 'utf8')).toBe(
      manifestBefore,
    );
  });

  it('prunes cache entries the run did not use', async () => {
    put('dmns/cover.webp', await image(960, 600, 'webp'));
    mkdirSync(join(dirs.cacheDir, 'unused'), { recursive: true });
    await runMediaPipeline(dirs);
    expect(readdirSync(dirs.cacheDir)).toHaveLength(1);
    expect(existsSync(join(dirs.cacheDir, 'unused'))).toBe(false);
  });

  it('removes outputs the current run did not produce', async () => {
    put('dmns/cover.webp', await image(960, 600, 'webp'));
    mkdirSync(join(dirs.outDir, 'gone'), { recursive: true });
    writeFileSync(join(dirs.outDir, 'gone/cover-480.webp'), 'stale');
    writeFileSync(join(dirs.outDir, 'stray.txt'), 'stale');

    const report = await runMediaPipeline(dirs);
    expect(report.errors).toEqual([]);
    expect(report.removed).toBe(2);
    expect(existsSync(join(dirs.outDir, 'gone'))).toBe(false);
    expect(existsSync(join(dirs.outDir, 'dmns/cover-960.webp'))).toBe(true);
  });
});
