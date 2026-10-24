// Whole-content fixtures (spec 004 content-json, FR-316): a valid bundle and one failing bundle
// per `RuleId`. `Record<RuleId, Fixture>` makes the compiler demand a case for every rule.
import { CONTENT_FILES, projectFile } from '../../../src/content/paths.ts';
import { type RuleId, parseJson } from '../../../src/content/validate/index.ts';
import { baseEras, baseResume, baseSite } from './documents.ts';
import { ERA_REF_PROJECT, type JsonObject, PROJECT_FIXTURES, baseProject } from './projects.ts';

type Bundle = Record<string, unknown>;

/** Four cobank projects, one Swiss (25 %). `demo` is the one the project fixtures replace. */
export const BASE_SLUGS = ['demo', 'swiss-one', 'p2', 'p3'] as const;

export function baseBundle(extra: Record<string, JsonObject> = {}): Bundle {
  const projects: Record<string, JsonObject> = {
    demo: baseProject('demo'),
    'swiss-one': baseProject('swiss-one', { treatment: 'swiss', motif: 'eclipse' }),
    p2: baseProject('p2'),
    p3: baseProject('p3'),
    ...extra,
  };
  const bundle: Bundle = {
    [CONTENT_FILES.order]: { cobank: Object.keys(projects) },
    [CONTENT_FILES.eras]: baseEras(),
    [CONTENT_FILES.site]: baseSite(),
    [CONTENT_FILES.resume]: baseResume(),
  };
  for (const [slug, project] of Object.entries(projects)) bundle[projectFile(slug)] = project;
  return bundle;
}

export interface Fixture {
  readonly raw: () => Bundle;
  readonly file: string;
  readonly path: string;
  readonly slug: string | null;
}

const projectCase = (project: JsonObject, path: string): Fixture => ({
  raw: () => ({ ...baseBundle(), [projectFile('demo')]: project }),
  file: projectFile('demo'),
  path,
  slug: 'demo',
});

const fromProject = (rule: keyof typeof PROJECT_FIXTURES): Fixture =>
  projectCase(PROJECT_FIXTURES[rule].project, PROJECT_FIXTURES[rule].path);

const standards = Object.fromEntries(
  ['s1', 's2', 's3', 's4', 's5', 's6'].map((slug) => [slug, baseProject(slug)]),
);

export const RULE_FIXTURES: Record<RuleId, Fixture> = {
  'json-parse': {
    raw: () => ({ ...baseBundle(), [CONTENT_FILES.order]: parseJson('{"cobank": [') }),
    file: CONTENT_FILES.order,
    path: '',
    slug: null,
  },
  shape: fromProject('shape'),
  'unknown-key': fromProject('unknown-key'),
  slug: fromProject('slug'),
  'text-length': fromProject('text-length'),
  'size-media': fromProject('size-media'),
  'gallery-media': fromProject('gallery-media'),
  'a11y-text': fromProject('a11y-text'),
  'placeholder-caption': fromProject('placeholder-caption'),
  'focal-format': fromProject('focal-format'),
  period: fromProject('period'),
  'era-ref': projectCase(ERA_REF_PROJECT.project, ERA_REF_PROJECT.path),
  'theme-name': fromProject('theme-name'),
  'motif-name': fromProject('motif-name'),
  url: fromProject('url'),
  'iframe-host': fromProject('iframe-host'),
  'media-key': fromProject('media-key'),
  'video-duration': fromProject('video-duration'),
  order: {
    raw: () => ({ ...baseBundle(), [CONTENT_FILES.order]: { cobank: [...BASE_SLUGS, 'ghost'] } }),
    file: CONTENT_FILES.order,
    path: '/cobank/4',
    slug: 'ghost',
  },
  'swiss-share': {
    raw: () => baseBundle({ 'swiss-one': baseProject('swiss-one') }),
    file: CONTENT_FILES.order,
    path: '',
    slug: null,
  },
  // swiss-one, then p2, p3, s1–s6: the 8th standard card in a row is s6.
  'standard-run': {
    raw: () => baseBundle(standards),
    file: projectFile('s6'),
    path: '/treatment',
    slug: 's6',
  },
  'swiss-motif-unique': {
    raw: () => baseBundle({ p3: baseProject('p3', { treatment: 'swiss', motif: 'eclipse' }) }),
    file: projectFile('p3'),
    path: '/motif',
    slug: 'p3',
  },
};
