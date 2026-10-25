// Per-file project rules (spec 004 content-json, FR-307, FR-313). Output is rebuilt field by
// field in `types.ts` order, and a per-size `switch` lets `tsc` check the size × media matrix.
import { ERA_IDS } from '../era-ids.ts';
import { MOTIFS } from '../motifs.ts';
import { slugOfFile } from '../paths.ts';
import { THEMES } from '../themes.ts';
import type {
  Engagement,
  GalleryItem,
  GallerySpan,
  Layout,
  Metric,
  Project,
  ProjectLink,
  Size,
  TrackItem,
  Treatment,
} from '../types.ts';
import { type ValidationContext, type Validated, finish } from './issue.ts';
import {
  type CardMediaRead,
  isDesktopFrame,
  isMobileFrame,
  readCardMedia,
  readGalleryMedia,
} from './media.ts';
import { Reader, Sink, each, readFocal, readHttps, readPeriod } from './read.ts';

const SIZES: readonly Size[] = ['sm', 'wide', 'tall', 'feature'];
const LAYOUTS: readonly Layout[] = ['title-top', 'title-bottom'];
const TREATMENTS: readonly Treatment[] = ['swiss', 'standard'];
export const ENGAGEMENTS: readonly Engagement[] = [
  'full-time',
  'contract',
  'freelance',
  'personal',
  'education',
];
const SPANS: readonly GallerySpan[] = ['sm', 'wide', 'tall', 'feature'];
const LINK_KINDS: readonly ProjectLink['kind'][] = [
  'live',
  'repo',
  'figma',
  'codepen',
  'storybook',
  'prototype',
  'video',
];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PLACEHOLDER_PREFIX = 'Placeholder ·';
/** FR-091 text limits. */
const LIMITS = { titleSm: 24, title: 40, summary: 160, tracklist: 8 } as const;

function readSlug(r: Reader, file: string): string | undefined {
  const slug = r.string('slug');
  if (slug === undefined) return undefined;
  if (!SLUG.test(slug)) r.error('slug', 'slug', `"${slug}" must be kebab-case (a-z, 0-9, -)`);
  const fromFile = slugOfFile(file);
  if (fromFile !== null && fromFile !== slug) {
    r.error('slug', 'slug', `"${slug}" must match the file name "${fromFile}.json"`);
  }
  return slug;
}

function readTrack(r: Reader): TrackItem | undefined {
  const label = r.string('label');
  const value = r.optionalString('value');
  if (label === undefined) return undefined;
  return { label, ...(value === undefined ? {} : { value }) };
}

function readMetric(r: Reader): Metric | undefined {
  const value = r.string('value');
  const label = r.string('label');
  const baseline = r.optionalString('baseline');
  const result = r.optionalString('result');
  if (value === undefined || label === undefined) return undefined;
  return {
    value,
    label,
    ...(baseline === undefined ? {} : { baseline }),
    ...(result === undefined ? {} : { result }),
  };
}

function readLink(r: Reader): ProjectLink | undefined {
  const label = r.string('label');
  const href = readHttps(r, 'href');
  const kind = r.oneOf('kind', LINK_KINDS);
  if (label === undefined || href === undefined || kind === undefined) return undefined;
  return { label, href, kind };
}

function readGalleryItem(r: Reader, ctx: ValidationContext): GalleryItem | undefined {
  const m = r.object('media');
  const media = m === undefined ? undefined : readGalleryMedia(m, ctx);
  m?.done();
  const label = r.text('label', 'Gallery label');
  if (
    media?.kind === 'placeholder' &&
    label !== undefined &&
    !label.startsWith(PLACEHOLDER_PREFIX)
  ) {
    r.error('placeholder-caption', 'label', `"${label}" must start with "${PLACEHOLDER_PREFIX}"`);
  }
  const span = r.optionalOneOf('span', SPANS);
  const focal = readFocal(r);
  if (media === undefined || label === undefined) return undefined;
  return {
    media,
    label,
    ...(span === undefined ? {} : { span }),
    ...(focal === undefined ? {} : { focal }),
  };
}

function readBody(r: Reader): Project['body'] | undefined {
  const b = r.object('body');
  if (b === undefined) return undefined;
  const context = b.string('context');
  const contribution = b.string('contribution');
  const outcome = b.string('outcome');
  b.done();
  if (context === undefined || contribution === undefined || outcome === undefined) {
    return undefined;
  }
  return { context, contribution, outcome };
}

function readTracklist(r: Reader): readonly TrackItem[] | undefined {
  const items = r.items('tracklist');
  if (items !== undefined && items.length > LIMITS.tracklist) {
    r.error(
      'text-length',
      'tracklist',
      `the track list has ${items.length} items, the limit is ${LIMITS.tracklist}`,
    );
  }
  return each(items, r.sink, 'a track item', readTrack);
}

type Base = Omit<Extract<Project, { size: 'sm' }>, 'size' | 'media'>;

/** Applies the size × media matrix (rule `size-media`, FR-035, data-model §2). */
function withMedia(m: Reader, base: Base, size: Size, media: CardMediaRead): Project | undefined {
  switch (size) {
    case 'sm':
      if (media.kind !== 'iframe') return { ...base, size, media };
      m.error('size-media', 'kind', 'an sm card cannot hold a live iframe');
      return undefined;
    case 'tall':
      if (media.kind !== 'iframe' || isMobileFrame(media)) return { ...base, size, media };
      m.error('size-media', 'viewport', 'a tall card takes a mobile-viewport iframe only');
      return undefined;
    case 'wide':
    case 'feature':
      if (media.kind !== 'iframe' || isDesktopFrame(media)) return { ...base, size, media };
      m.error('size-media', 'viewport', `a ${size} card takes a desktop-viewport iframe only`);
      return undefined;
  }
}

function readProject(r: Reader, file: string, ctx: ValidationContext): Project | undefined {
  const slug = readSlug(r, file);
  const size = r.oneOf('size', SIZES);
  const title = r.limited('title', size === 'sm' ? LIMITS.titleSm : LIMITS.title);
  const client = r.string('client');
  const era = r.named('era', ERA_IDS, 'era-ref');
  const engagement = r.oneOf('engagement', ENGAGEMENTS);
  const role = r.string('role');
  const period = readPeriod(r);
  const theme = r.named('theme', THEMES, 'theme-name');
  const motif = r.named('motif', MOTIFS, 'motif-name');
  const seed = r.optionalNumber('seed');
  const layout = r.oneOf('layout', LAYOUTS);
  const treatment = r.oneOf('treatment', TREATMENTS);
  const summary = r.limited('summary', LIMITS.summary);
  const body = readBody(r);
  const tracklist = readTracklist(r);
  const metrics = each(r.items('metrics', true), r.sink, 'a metric', readMetric);
  const links = each(r.items('links', true), r.sink, 'a link', readLink);
  const gallery = each(r.items('gallery', true), r.sink, 'a gallery tile', (g) =>
    readGalleryItem(g, ctx),
  );
  const draft = r.optionalBoolean('draft');
  const m = r.object('media');
  const media = m === undefined ? undefined : readCardMedia(m, ctx);
  m?.done();

  if (slug === undefined || title === undefined || client === undefined) return undefined;
  if (era === undefined || engagement === undefined || role === undefined) return undefined;
  if (period === undefined || theme === undefined || motif === undefined) return undefined;
  if (layout === undefined || treatment === undefined || summary === undefined) return undefined;
  if (body === undefined || tracklist === undefined) return undefined;
  if (size === undefined || m === undefined || media === undefined) return undefined;
  const base: Base = {
    slug,
    title,
    client,
    era,
    engagement,
    role,
    period,
    theme,
    motif,
    ...(seed === undefined ? {} : { seed }),
    layout,
    treatment,
    summary,
    body,
    tracklist,
    ...(metrics === undefined ? {} : { metrics }),
    ...(links === undefined ? {} : { links }),
    ...(gallery === undefined ? {} : { gallery }),
    ...(draft === undefined ? {} : { draft }),
  };
  return withMedia(m, base, size, media);
}

/**
 * Validates one project file (FR-305): every per-file rule in FR-313. `file` is the repo path,
 * and its name must equal the slug.
 */
export function validateProject(
  raw: unknown,
  file: string,
  ctx: ValidationContext,
): Validated<Project> {
  const sink = new Sink(file, slugOfFile(file));
  const r = Reader.open(raw, '', sink, 'A project');
  const project = r === undefined ? undefined : readProject(r, file, ctx);
  r?.done();
  return finish(project, sink.issues);
}
