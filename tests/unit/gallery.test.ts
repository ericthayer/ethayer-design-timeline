// Gallery and Swiss-motif rules (spec 003, FR-210–FR-220, US11). Each rule names the slug.
import { describe, expect, it } from 'vitest';
import { MEDIA_MANIFEST } from '../../src/components/card-media/image.ts';
import { PROJECTS } from '../../src/content/projects/index.ts';
import { MOTIFS } from '../../src/content/motifs.ts';
import type { GallerySpan } from '../../src/content/types.ts';

const SPANS: readonly GallerySpan[] = ['sm', 'wide', 'tall', 'feature'];
const FOCAL = /^\d{1,3}% \d{1,3}%$/;

describe('bento gallery (spec 003)', () => {
  it('gives every gallery tile a caption, a valid span, and a valid focal point', () => {
    for (const p of PROJECTS) {
      for (const item of p.gallery ?? []) {
        expect(item.label.trim().length, p.slug).toBeGreaterThan(0);
        expect(SPANS.includes(item.span ?? 'sm'), `${p.slug}: ${String(item.span)}`).toBe(true);
        if (item.focal) expect(item.focal, p.slug).toMatch(FOCAL);
      }
    }
  });

  it('labels every placeholder tile as a placeholder (honest captions)', () => {
    for (const p of PROJECTS) {
      for (const item of p.gallery ?? []) {
        if (item.media.kind === 'placeholder') {
          expect(item.label.startsWith('Placeholder ·'), `${p.slug}: ${item.label}`).toBe(true);
        }
      }
    }
  });

  it('gives every gallery image alt text and a manifest entry', () => {
    for (const p of PROJECTS) {
      for (const item of p.gallery ?? []) {
        if (item.media.kind !== 'image') continue;
        expect(item.media.alt.trim().length, p.slug).toBeGreaterThan(0);
        expect(MEDIA_MANIFEST[item.media.src], `${p.slug}: ${item.media.src}`).toBeDefined();
      }
    }
  });

  it('ships placeholder galleries for the five projects named in FR-220', () => {
    const withGallery = PROJECTS.filter((p) => (p.gallery?.length ?? 0) > 0).map((p) => p.slug);
    expect(withGallery.sort()).toEqual(
      [
        'cobank-design-system',
        'dli-mobile-learning',
        'figma-token-pipeline',
        'hs-vue-library',
        'kentico-framework',
        'motion-reel',
      ].sort(),
    );
  });
});

describe('swiss motifs (spec 003, US11)', () => {
  const swiss = PROJECTS.filter((p) => p.treatment === 'swiss');

  it('gives every Swiss card its own motif', () => {
    const motifs = swiss.map((p) => p.motif);
    expect(new Set(motifs).size, motifs.join(', ')).toBe(motifs.length);
  });

  it('only uses registered motifs', () => {
    for (const p of PROJECTS) expect(MOTIFS.includes(p.motif), p.slug).toBe(true);
  });
});
