// Usage: node scripts/capture-clip.ts <slug> <https-url | path/to/full-page-image>
// URL: records a scripted scroll of the live site. Image: pans down a full-page design export,
// which is the faithful option when the live site no longer shows the original work.
// Encodes an 8 s silent loop (FR-031): media-src/<slug>/clip.webm (VP9) and clip.mp4 (H.264).
// Run `npm run media` afterwards: the build copies clips to public/media byte for byte (FR-326).
// The card poster reuses <slug>/cover.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [slug, source] = process.argv.slice(2);
if (!slug || !source) {
  console.error('Usage: node scripts/capture-clip.ts <slug> <https-url | image-path>');
  process.exit(1);
}

const VIEWPORT = { width: 1440, height: 900 };
const workDir = mkdtempSync(join(tmpdir(), 'clip-'));

async function recordLiveScroll(url: string): Promise<string[]> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: workDir, size: VIEWPORT },
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForTimeout(1500);
  for (let step = 0; step < 80; step += 1) {
    await page.mouse.wheel(0, 18);
    await page.waitForTimeout(100);
  }
  await context.close();
  await browser.close();
  const raw = readdirSync(workDir).find((f) => f.endsWith('.webm'));
  if (!raw) throw new Error('Playwright produced no recording');
  return ['-ss', '1.5', '-t', '8', '-i', join(workDir, raw), '-vf', 'scale=960:-2,fps=24'];
}

function panImage(path: string): string[] {
  // 960 × 600 window easing down the page and back up, so the 8 s loop has no jump.
  const y = "'(ih-600)*0.5*(1-cos(2*PI*t/8))'";
  return ['-loop', '1', '-t', '8', '-i', path, '-vf', `scale=960:-2,crop=960:600:0:${y},fps=24`];
}

const inputArgs = source.startsWith('https://') ? await recordLiveScroll(source) : panImage(source);
const outDir = join('media-src', slug);
mkdirSync(outDir, { recursive: true });

const common = ['-y', ...inputArgs, '-an'];
execFileSync(
  'ffmpeg',
  [...common, '-c:v', 'libvpx-vp9', '-crf', '42', '-b:v', '0', join(outDir, 'clip.webm')],
  { stdio: 'ignore' },
);
execFileSync(
  'ffmpeg',
  [
    ...common,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '30',
    '-movflags',
    '+faststart',
    join(outDir, 'clip.mp4'),
  ],
  { stdio: 'ignore' },
);
rmSync(workDir, { recursive: true, force: true });

for (const ext of ['webm', 'mp4']) {
  const size = statSync(join(outDir, `clip.${ext}`)).size;
  console.log(`${slug}/clip.${ext}: ${(size / 1024).toFixed(0)} KB`);
}
