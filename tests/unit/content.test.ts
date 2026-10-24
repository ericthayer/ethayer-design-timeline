// Content checks. The content rules live in the shared validator (spec 004 content-json); the
// files-on-disk checks stay here (FR-314) until media-pipeline takes them over.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readContext, readRawContent } from '../../scripts/content-fs.ts';
import { MEDIA_MANIFEST } from '../../src/components/card-media/image.ts';
import { ERAS } from '../../src/content/eras.ts';
import { PROJECTS } from '../../src/content/projects/index.ts';
import { RESUME } from '../../src/content/resume.ts';
import { SITE } from '../../src/content/site.ts';
import type { ImageMedia, Project } from '../../src/content/types.ts';
import { validateContent } from '../../src/content/validate/index.ts';

const images = (p: Project): ImageMedia[] => {
  const m = p.media;
  if (m.kind === 'image') return [m];
  if (m.kind === 'video' || m.kind === 'iframe') return [m.poster];
  return [];
};

describe('content', () => {
  it('gives every image alt text and optimized files on disk', () => {
    for (const p of PROJECTS) {
      for (const img of images(p)) {
        expect(img.alt.trim().length, p.slug).toBeGreaterThan(0);
        const entry = MEDIA_MANIFEST[img.src];
        expect(entry, `${p.slug}: ${img.src} missing from manifest`).toBeDefined();
        for (const w of entry?.widths ?? []) {
          for (const ext of ['avif', 'webp']) {
            const file = `public/media/${img.src}-${String(w)}.${ext}`;
            expect(existsSync(file), file).toBe(true);
          }
        }
      }
    }
  });

  it('ships every video in both formats, 8 s or shorter', () => {
    for (const p of PROJECTS) {
      if (p.media.kind !== 'video') continue;
      expect(p.media.durationSec, p.slug).toBeLessThanOrEqual(8);
      for (const ext of ['webm', 'mp4']) {
        expect(existsSync(`public/media/${p.media.src}.${ext}`), p.slug).toBe(true);
      }
    }
  });
});

// Spec 004 content-json (FR-303, FR-316): the shared validator on the real content files.
describe('content files (shared validator)', () => {
  const result = validateContent(readRawContent('.'), readContext('.'));

  it('have 0 errors and 0 warnings', () => {
    expect(result.ok ? [] : result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('load exactly what the validator returns (loader ≡ validator)', () => {
    if (!result.ok) throw new Error('content is invalid');
    expect(PROJECTS).toStrictEqual(result.value.projects);
    expect(ERAS).toStrictEqual(result.value.eras);
    expect(SITE).toStrictEqual(result.value.site);
    expect(RESUME).toStrictEqual(result.value.resume);
  });
});
