// Project fixtures for the validator (spec 004 content-json, FR-316): a valid base project and
// one breaking change per per-file rule. Values are plain JSON, as the files hold them.
import type { RuleId, ValidationContext } from '../../../src/content/validate/issue.ts';

export type JsonObject = Record<string, unknown>;

export const CTX: ValidationContext = {
  mediaKeys: new Set(['demo/cover']),
  videoKeys: new Set(['demo/clip']),
  frameOrigins: ['https://demo.netlify.app'],
};

const image = { kind: 'image', src: 'demo/cover', alt: 'Demo home page' };

/** A valid `sm` project. Every fixture starts from a fresh copy. */
export function baseProject(slug: string, overrides: JsonObject = {}): JsonObject {
  return {
    slug,
    title: 'Demo',
    client: 'Demo Co',
    era: 'cobank',
    engagement: 'full-time',
    role: 'Engineer',
    period: { start: '2024-01', end: 'present' },
    theme: 'paper-ink',
    motif: 'petals',
    layout: 'title-bottom',
    treatment: 'standard',
    summary: 'A demo project.',
    body: { context: 'Context.', contribution: 'Contribution.', outcome: 'Outcome.' },
    tracklist: [{ label: 'TypeScript' }],
    size: 'sm',
    media: { kind: 'placeholder', variant: 'site' },
    ...overrides,
  };
}

export interface ProjectFixture {
  /** The project file's content. Its file is `projects/demo.json`. */
  readonly project: JsonObject;
  readonly path: string;
}

const placeholderTile = (label: string, extra: JsonObject = {}): JsonObject => ({
  media: { kind: 'placeholder', variant: 'site' },
  label,
  ...extra,
});

export type ProjectRule = Exclude<
  RuleId,
  'json-parse' | 'era-ref' | 'order' | 'swiss-share' | 'standard-run' | 'swiss-motif-unique'
>;

/** One failing project per per-file rule (FR-313). */
export const PROJECT_FIXTURES: Record<ProjectRule, ProjectFixture> = {
  shape: { project: baseProject('demo', { size: 'huge' }), path: '/size' },
  'unknown-key': { project: baseProject('demo', { color: 'red' }), path: '/color' },
  slug: { project: baseProject('other'), path: '/slug' },
  'text-length': {
    project: baseProject('demo', { title: 'A title that is too long!' }),
    path: '/title',
  },
  'size-media': {
    project: baseProject('demo', {
      media: {
        kind: 'iframe',
        src: 'https://demo.netlify.app/',
        title: 'Live demo',
        viewport: 'desktop',
        poster: image,
      },
    }),
    path: '/media/kind',
  },
  'gallery-media': {
    project: baseProject('demo', {
      gallery: [{ media: { kind: 'iframe', src: 'https://demo.netlify.app/' }, label: 'Live' }],
    }),
    path: '/gallery/0/media/kind',
  },
  'a11y-text': {
    project: baseProject('demo', { media: { ...image, alt: '  ' } }),
    path: '/media/alt',
  },
  'placeholder-caption': {
    project: baseProject('demo', { gallery: [placeholderTile('Token editor')] }),
    path: '/gallery/0/label',
  },
  'focal-format': {
    project: baseProject('demo', {
      gallery: [placeholderTile('Placeholder · Docs', { focal: '30%, 40%' })],
    }),
    path: '/gallery/0/focal',
  },
  period: {
    project: baseProject('demo', { period: { start: '2024-13', end: 'present' } }),
    path: '/period/start',
  },
  'theme-name': { project: baseProject('demo', { theme: 'neon' }), path: '/theme' },
  'motif-name': { project: baseProject('demo', { motif: 'spiral' }), path: '/motif' },
  url: {
    project: baseProject('demo', {
      links: [{ label: 'Live', href: 'http://demo.example/', kind: 'live' }],
    }),
    path: '/links/0/href',
  },
  'iframe-host': {
    project: baseProject('demo', {
      size: 'wide',
      media: {
        kind: 'iframe',
        src: 'https://evil.example/',
        title: 'Live',
        viewport: 'desktop',
        poster: image,
      },
    }),
    path: '/media/src',
  },
  'media-key': {
    project: baseProject('demo', { media: { ...image, src: 'missing/cover' } }),
    path: '/media/src',
  },
  'video-duration': {
    project: baseProject('demo', {
      media: { kind: 'video', src: 'demo/clip', poster: image, label: 'Clip', durationSec: 9 },
    }),
    path: '/media/durationSec',
  },
};

/** The project-level `era-ref` case: an era id outside `ERA_IDS`. */
export const ERA_REF_PROJECT: ProjectFixture = {
  project: baseProject('demo', { era: 'nasa' }),
  path: '/era',
};
