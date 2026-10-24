// Content checks. The content rules live in the shared validator (spec 004 content-json); the
// media-source checks belong to media-pipeline (FR-339).
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readContext, readRawContent } from '../../scripts/content-fs.ts';
import { MEDIA_MANIFEST } from '../../src/components/card-media/image.ts';
import { ERAS } from '../../src/content/eras.ts';
import { PROJECTS } from '../../src/content/projects/index.ts';
import { RESUME } from '../../src/content/resume.ts';
import { SITE } from '../../src/content/site.ts';
import type { ImageMedia, Project } from '../../src/content/types.ts';
import { validateContent } from '../../src/content/validate/index.ts';
import { IMAGE_EXTENSIONS, SOURCE_ROOT, parseSourcePath } from '../../src/core/media-rules.ts';

// Source extensions per media key, read straight from media-src/ (FR-339): no build needed.
const SOURCES = new Map<string, string[]>();
for (const entry of readdirSync(SOURCE_ROOT, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const parsed = parseSourcePath(`${entry.parentPath}/${entry.name}`.replaceAll('\\', '/'));
  if (parsed.ok) SOURCES.set(parsed.key, [...(SOURCES.get(parsed.key) ?? []), parsed.ext]);
}
const sourcesFor = (key: string): string[] => SOURCES.get(key) ?? [];
const isImageExtension = (ext: string): boolean =>
  (IMAGE_EXTENSIONS as readonly string[]).includes(ext);

const images = (p: Project): ImageMedia[] => {
  const m = p.media;
  if (m.kind === 'image') return [m];
  if (m.kind === 'video' || m.kind === 'iframe') return [m.poster];
  return [];
};

describe('content', () => {
  it('gives every image alt text and one source in media-src/ (FR-339)', () => {
    for (const p of PROJECTS) {
      for (const img of images(p)) {
        expect(img.alt.trim().length, p.slug).toBeGreaterThan(0);
        const entry = MEDIA_MANIFEST[img.src];
        expect(entry, `${p.slug}: ${img.src} missing from manifest`).toBeDefined();
        const found = sourcesFor(img.src).filter((ext) => isImageExtension(ext));
        expect(found, `${p.slug}: ${img.src} needs exactly one image in media-src/`).toHaveLength(
          1,
        );
      }
    }
  });

  it('sources every video in both formats, 8 s or shorter (FR-339)', () => {
    for (const p of PROJECTS) {
      if (p.media.kind !== 'video') continue;
      expect(p.media.durationSec, p.slug).toBeLessThanOrEqual(8);
      const found = sourcesFor(p.media.src);
      for (const ext of ['webm', 'mp4']) {
        expect(found, `${p.slug}: ${p.media.src}.${ext} missing from media-src/`).toContain(ext);
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
