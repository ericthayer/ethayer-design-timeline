import { describe, expect, it } from 'vitest';
import { renderPlaceholder } from '../../src/components/card-media/placeholder.ts';
import { MOTIF_REGISTRY, renderArtwork } from '../../src/components/swiss-artwork/swiss-artwork.ts';
import { MOTIFS } from '../../src/content/motifs.ts';

const serialize = (node: Node): string => new XMLSerializer().serializeToString(node);

describe('swiss artwork (FR-040)', () => {
  it('registers a generator for every motif', () => {
    expect(Object.keys(MOTIF_REGISTRY).sort()).toEqual([...MOTIFS].sort());
  });

  it.each(MOTIFS)('%s is deterministic per seed and stays ≤ 400 nodes', (motif) => {
    const a = renderArtwork(motif, 42);
    const b = renderArtwork(motif, 42);
    expect(serialize(a)).toBe(serialize(b));
    expect(a.querySelectorAll('*').length).toBeLessThanOrEqual(400);
    expect(a.getAttribute('aria-hidden')).toBe('true');
  });

  it('varies with the seed (at least 3 distinct drawings across five seeds)', () => {
    for (const motif of MOTIFS) {
      const drawings = new Set(
        [101, 2024, 90210, 777777, 31337].map((seed) => serialize(renderArtwork(motif, seed))),
      );
      expect(drawings.size, motif).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('placeholder (FR-036)', () => {
  it.each(['site', 'mobile', 'video', 'design'] as const)(
    '%s renders a decorative wireframe',
    (variant) => {
      const svg = renderPlaceholder(variant, 7);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.children.length).toBeGreaterThan(2);
      expect(serialize(svg)).toBe(serialize(renderPlaceholder(variant, 7)));
    },
  );
});
