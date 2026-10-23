// Content validation (FR-091, FR-011b, US8): every rule names the slug that breaks it.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MEDIA_MANIFEST } from '../../src/components/card-media/image.ts';
import { ERAS } from '../../src/content/eras.ts';
import { PROJECTS } from '../../src/content/projects/index.ts';
import type { ImageMedia, Project } from '../../src/content/types.ts';
import { buildWallItems, projectSequence } from '../../src/core/order.ts';

const images = (p: Project): ImageMedia[] => {
  const m = p.media;
  if (m.kind === 'image') return [m];
  if (m.kind === 'video' || m.kind === 'iframe') return [m.poster];
  return [];
};

describe('content', () => {
  it('has unique kebab-case slugs', () => {
    const slugs = PROJECTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug, slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('keeps titles within their tier length (sm ≤ 24, others ≤ 40)', () => {
    for (const p of PROJECTS) {
      expect(p.title.length, p.slug).toBeLessThanOrEqual(p.size === 'sm' ? 24 : 40);
    }
  });

  it('keeps summaries ≤ 160 chars and track lists ≤ 8', () => {
    for (const p of PROJECTS) {
      expect(p.summary.length, p.slug).toBeLessThanOrEqual(160);
      expect(p.tracklist.length, p.slug).toBeLessThanOrEqual(8);
    }
  });

  it('references real eras and ordered periods', () => {
    const eraIds = new Set<string>(ERAS.map((e) => e.id));
    for (const p of PROJECTS) {
      expect(eraIds.has(p.era), p.slug).toBe(true);
      if (p.period.end !== 'present') {
        expect(p.period.start <= p.period.end, p.slug).toBe(true);
      }
    }
  });

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

  it('allows every iframe host in the CSP frame-src', () => {
    const csp = readFileSync('netlify.toml', 'utf8');
    const frameSrc = /frame-src ([^;]+);/.exec(csp)?.[1]?.split(' ') ?? [];
    for (const p of PROJECTS) {
      if (p.media.kind !== 'iframe') continue;
      expect(frameSrc, p.slug).toContain(new URL(p.media.src).origin);
    }
  });

  it('puts the Swiss treatment on 20–30 % of projects, spread evenly (FR-011b)', () => {
    const sequence = projectSequence(buildWallItems(PROJECTS, ERAS));
    const swiss = sequence.filter((p) => p.treatment === 'swiss').length;
    const share = swiss / sequence.length;
    expect(share).toBeGreaterThanOrEqual(0.2);
    expect(share).toBeLessThanOrEqual(0.3);
    let run = 0;
    let longest = 0;
    for (const p of sequence) {
      run = p.treatment === 'standard' ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThanOrEqual(7);
  });
});
