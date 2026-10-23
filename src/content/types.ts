import type { MOTIFS } from './motifs.ts';
import type { THEMES } from './themes.ts';

export type Size = 'sm' | 'wide' | 'tall' | 'feature';
export type Layout = 'title-top' | 'title-bottom';
export type Treatment = 'swiss' | 'standard';
export type Engagement = 'full-time' | 'contract' | 'freelance' | 'personal' | 'education';
type Month = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12';
export type YearMonth = `${number}-${Month}`;
export type ThemeName = (typeof THEMES)[number];
export type MotifName = (typeof MOTIFS)[number];

export interface ImageMedia {
  readonly kind: 'image';
  /** Manifest key, e.g. 'dmns/cover' → /media/dmns/cover-{w}.{avif,webp}. */
  readonly src: string;
  readonly alt: string;
  readonly focal?: `${number}% ${number}%`;
  readonly treatment?: 'duotone' | 'none';
}

export interface VideoMedia {
  readonly kind: 'video';
  /** Base path, e.g. 'merchants/clip' → /media/merchants/clip.{webm,mp4}. */
  readonly src: string;
  readonly poster: ImageMedia;
  readonly label: string;
  readonly durationSec: number;
}

export interface IframeMedia<V extends 'desktop' | 'mobile' = 'desktop' | 'mobile'> {
  readonly kind: 'iframe';
  readonly src: `https://${string}`;
  readonly title: string;
  readonly viewport: V;
  readonly poster: ImageMedia;
}

export interface ArtworkMedia {
  readonly kind: 'artwork';
}

export interface PlaceholderMedia {
  readonly kind: 'placeholder';
  readonly variant: 'site' | 'mobile' | 'video' | 'design';
}

export interface VimeoMedia {
  readonly kind: 'vimeo';
  readonly id: string;
  readonly title: string;
}

/** Allowed size × media combinations (data-model §2). Invalid pairs fail typecheck. */
export type CardMedia<S extends Size> = S extends 'sm'
  ? ArtworkMedia | PlaceholderMedia | ImageMedia | VideoMedia
  : S extends 'tall'
    ? ArtworkMedia | PlaceholderMedia | ImageMedia | VideoMedia | IframeMedia<'mobile'>
    : ArtworkMedia | PlaceholderMedia | ImageMedia | VideoMedia | IframeMedia<'desktop'>;

export type AnyCardMedia = CardMedia<Size>;
export type DialogMedia = ImageMedia | VideoMedia | IframeMedia | VimeoMedia;

export interface TrackItem {
  readonly label: string;
  readonly value?: string;
}

export interface Metric {
  readonly value: string;
  readonly label: string;
  readonly baseline?: string;
  readonly result?: string;
}

export interface ProjectLink {
  readonly label: string;
  readonly href: `https://${string}`;
  readonly kind: 'live' | 'repo' | 'figma' | 'codepen' | 'storybook' | 'prototype' | 'video';
}

export interface Period {
  readonly start: YearMonth;
  readonly end: YearMonth | 'present';
}

export type EraId =
  | 'cobank'
  | 'threecolts'
  | 'health-scholars'
  | 'independent'
  | 'navigators'
  | 'dli'
  | 'post-production';

export interface Era {
  readonly id: EraId;
  readonly label: string;
  readonly period: Period;
  readonly engagement: Engagement;
}

interface ProjectBase {
  readonly slug: string;
  readonly title: string;
  readonly client: string;
  readonly era: EraId;
  readonly engagement: Engagement;
  readonly role: string;
  readonly period: Period;
  readonly theme: ThemeName;
  readonly motif: MotifName;
  readonly seed?: number;
  readonly layout: Layout;
  readonly treatment: Treatment;
  readonly summary: string;
  readonly body: {
    readonly context: string;
    readonly contribution: string;
    readonly outcome: string;
  };
  readonly tracklist: readonly TrackItem[];
  readonly metrics?: readonly Metric[];
  readonly links?: readonly ProjectLink[];
  readonly gallery?: readonly DialogMedia[];
  /** Placeholder copy pending owner review. */
  readonly draft?: boolean;
}

/** Distributive discriminated union on `size`. */
export type Project = {
  [S in Size]: ProjectBase & { readonly size: S; readonly media: CardMedia<S> };
}[Size];

/** Derived render list consumed by <timeline-wall>. */
export type WallItem =
  | { readonly type: 'identity' }
  | { readonly type: 'era'; readonly era: Era }
  | {
      readonly type: 'project';
      readonly project: Project;
      readonly index: number;
      readonly total: number;
    }
  | { readonly type: 'end-cap' };
