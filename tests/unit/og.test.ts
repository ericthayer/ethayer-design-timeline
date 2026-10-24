// Link-preview images (FR-106): card data, committed PNGs, and their freshness.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { seedOf } from '../../src/components/card-media/card-media.ts';
import {
  HOME_OG_SLUG,
  OG_SIZE,
  homeOgCard,
  ogCardFor,
  ogCards,
  ogHash,
  ogImagePath,
} from '../../src/content/og.ts';
import { PROJECTS } from '../../src/content/projects/index.ts';

const manifest = JSON.parse(readFileSync('src/content/og-manifest.json', 'utf8')) as Record<
  string,
  string
>;
const cards = ogCards(PROJECTS);
const fileFor = (slug: string): string => `public${ogImagePath(slug)}`;

describe('card data', () => {
  it('has the home card first, then one card per project, with unique slugs', () => {
    expect(cards).toHaveLength(PROJECTS.length + 1);
    expect(cards[0]?.slug).toBe(HOME_OG_SLUG);
    expect(new Set(cards.map((card) => card.slug)).size).toBe(cards.length);
  });

  it('draws the same artwork as the wall card', () => {
    for (const project of PROJECTS) {
      expect(ogCardFor(project).seed, project.slug).toBe(seedOf(project));
      expect(ogCardFor(project).motif, project.slug).toBe(project.motif);
      expect(ogCardFor(project).theme, project.slug).toBe(project.theme);
    }
  });

  it('keeps footer lines short and gives every card alt text', () => {
    for (const card of cards) {
      expect(card.tracks.length, card.slug).toBeLessThanOrEqual(3);
      expect(card.alt.trim().length, card.slug).toBeGreaterThan(0);
      expect(card.title.trim().length, card.slug).toBeGreaterThan(0);
    }
  });

  it('changes its hash whenever something the card shows changes', () => {
    const first = PROJECTS[0];
    if (!first) throw new Error('No projects');
    const card = ogCardFor(first);
    expect(ogHash(card)).toBe(ogHash({ ...card }));
    expect(ogHash(card)).toMatch(/^[0-9a-f]{8}$/);
    for (const change of [
      { title: `${card.title}!` },
      { theme: card.theme === 'coral' ? 'navy' : 'coral' },
      { seed: card.seed + 1 },
      { year: '1999' },
      { tracks: [...card.tracks, 'extra'] },
    ] as const) {
      expect(ogHash({ ...card, ...change }), JSON.stringify(change)).not.toBe(ogHash(card));
    }
    expect(homeOgCard().title).toBe('Eric Thayer');
  });
});

describe('committed images', () => {
  it('ships a 1200 × 630 PNG for every card', () => {
    for (const card of cards) {
      const file = fileFor(card.slug);
      expect(existsSync(file), `${file} is missing: run npm run og`).toBe(true);
      const bytes = readFileSync(file);
      expect(bytes.subarray(1, 4).toString(), file).toBe('PNG');
      expect(bytes.readUInt32BE(16), `${file} width`).toBe(OG_SIZE.width);
      expect(bytes.readUInt32BE(20), `${file} height`).toBe(OG_SIZE.height);
      expect(statSync(file).size, `${file} is heavy`).toBeLessThan(150 * 1024);
    }
  });

  it('is fresh: every card hash matches the manifest', () => {
    for (const card of cards) {
      expect(manifest[card.slug], `${card.slug} is stale: run npm run og`).toBe(ogHash(card));
    }
  });

  it('has no orphan images or manifest entries', () => {
    const wanted = new Set(cards.map((card) => card.slug));
    for (const slug of Object.keys(manifest)) {
      expect(wanted.has(slug), `manifest lists unknown card "${slug}"`).toBe(true);
    }
    for (const file of readdirSync('public/og')) {
      expect(wanted.has(file.replace(/\.png$/, '')), `orphan public/og/${file}`).toBe(true);
    }
  });
});
