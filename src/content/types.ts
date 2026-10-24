import type { ERA_IDS } from './era-ids.ts';
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

export type GallerySpan = 'sm' | 'wide' | 'tall' | 'feature';
/** Focal point as CSS percentages, e.g. '30% 40%' (spec 003, FR-213). */
export type Focal = `${number}% ${number}%`;

/** One tile in the dialog's bento gallery (spec 003, FR-210). Iframes are excluded (FR-211). */
export interface GalleryItem {
  readonly media: ImageMedia | VideoMedia | VimeoMedia | PlaceholderMedia;
  /** Visible caption, and the accessible name for decorative tiles. */
  readonly label: string;
  readonly span?: GallerySpan;
  readonly focal?: Focal;
}

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

export type EraId = (typeof ERA_IDS)[number];

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
  readonly gallery?: readonly GalleryItem[];
  /** Placeholder copy pending owner review. */
  readonly draft?: boolean;
}

/** Distributive discriminated union on `size`. */
export type Project = {
  [S in Size]: ProjectBase & { readonly size: S; readonly media: CardMedia<S> };
}[Size];

/** Curated project order within each era: `order.json` (spec 004 content-json, FR-301). */
export type ProjectOrder = { readonly [E in EraId]?: readonly string[] };

/** Derived render list consumed by <timeline-wall>. */
export type WallItem =
  | { readonly type: 'era'; readonly era: Era }
  | {
      readonly type: 'project';
      readonly project: Project;
      readonly index: number;
      readonly total: number;
    }
  | { readonly type: 'end-cap' };

/** Optional intro video at the top of the résumé (spec 002, FR-121). Captions are required. */
export interface ResumeIntro {
  /** Base path, e.g. 'resume/intro' → /media/resume/intro.{webm,mp4}. */
  readonly src: string;
  readonly poster: ImageMedia;
  /** WebVTT captions (WCAG 1.2.2), e.g. '/media/resume/intro.vtt'. */
  readonly captions: `/media/${string}.vtt`;
  readonly title: string;
  readonly durationSec: number;
}

export interface ResumeRole {
  readonly role: string;
  readonly company: string;
  readonly location: string;
  readonly period: Period;
  readonly summary: string;
  readonly highlights: readonly string[];
  readonly href?: `https://${string}`;
}

export interface ResumeProject {
  readonly title: string;
  readonly detail: string;
  readonly year: string;
  readonly href?: `https://${string}`;
}

/** HTML résumé (spec 002, FR-120). Public content only: no phone numbers or references. */
export interface Resume {
  readonly headline: string;
  readonly summary: string;
  readonly intro?: ResumeIntro;
  readonly experience: readonly ResumeRole[];
  readonly skills: readonly string[];
  readonly proficiencies: {
    readonly development: readonly string[];
    readonly software: readonly string[];
  };
  readonly projects: readonly ResumeProject[];
}

export interface SiteLink {
  readonly label: string;
  /** `/resume` opens <resume-dialog> (spec 002, FR-124). */
  readonly href: '/resume' | `https://${string}` | `mailto:${string}`;
}

export interface Education {
  readonly degree: string;
  readonly school: string;
  readonly year: string;
}

/** Identity, contact, and education for the hero, end-cap, and résumé (`site.json`, FR-300). */
export interface Site {
  readonly name: string;
  readonly role: string;
  readonly location: string;
  readonly summary: string;
  readonly span: Period;
  readonly links: readonly SiteLink[];
  readonly education: readonly Education[];
}
