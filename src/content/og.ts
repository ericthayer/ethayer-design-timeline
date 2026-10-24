/**
 * Link-preview card data (FR-136). Pure and erasable TypeScript, so the Playwright renderer, the
 * prerender plugin, and the freshness test all read one definition. Node runs scripts that import
 * this without a compiler, so no enums or parameter properties.
 */
import { hashSeed, indexNumerals, yearRange } from '../core/format.ts';
import { SITE } from './site.ts';
import type { Layout, MotifName, Project, ThemeName } from './types.ts';

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Bump when tools/og-card changes, so every committed image counts as stale. */
export const OG_VERSION = 1;

export const HOME_OG_SLUG = 'home';

/** A project poster draws a Swiss motif; the home card draws the hero's triangle cascade. */
export type OgArt =
  | { readonly kind: 'motif'; readonly motif: MotifName; readonly seed: number }
  | { readonly kind: 'hero' };

export interface OgCard {
  readonly slug: string;
  readonly theme: ThemeName;
  readonly art: OgArt;
  readonly layout: Layout;
  readonly kicker: string;
  readonly numerals: readonly [string, string];
  readonly title: string;
  readonly year: string;
  readonly tracks: readonly string[];
  readonly alt: string;
}

export const ogImagePath = (slug: string): string => `/og/${slug}.png`;

export function homeOgCard(): OgCard {
  const [first, second] = indexNumerals(SITE.span);
  return {
    slug: HOME_OG_SLUG,
    theme: 'plum-ember', // the hero's palette and artwork (spec 002)
    art: { kind: 'hero' },
    layout: 'title-top',
    kicker: SITE.role,
    numerals: [first, second],
    title: SITE.name,
    year: yearRange(SITE.span),
    tracks: SITE.highlights,
    alt: `${SITE.name}, ${SITE.role}. Poster with a cascade of overlapping triangles.`,
  };
}

export function ogCardFor(project: Project): OgCard {
  const [first, second] = indexNumerals(project.period);
  const years = yearRange(project.period);
  return {
    slug: project.slug,
    theme: project.theme,
    art: {
      kind: 'motif',
      motif: project.motif,
      seed: project.seed ?? hashSeed(project.slug), // must match seedOf() in card-media.ts
    },
    layout: project.layout,
    kicker: project.client,
    numerals: [first, second],
    title: project.title,
    year: years,
    tracks: project.tracklist
      .slice(0, 3)
      .map((track) => (track.value ? `${track.label} ${track.value}` : track.label)),
    alt: `Poster for ${project.title}: ${project.client}, ${years}.`,
  };
}

/** The home card first, then one per project. */
export function ogCards(projects: readonly Project[]): OgCard[] {
  return [homeOgCard(), ...projects.map(ogCardFor)];
}

/** Change detector for committed images: an 8-digit hex digest of everything the card renders. */
export function ogHash(card: OgCard): string {
  return hashSeed(JSON.stringify([OG_VERSION, card]))
    .toString(16)
    .padStart(8, '0');
}
