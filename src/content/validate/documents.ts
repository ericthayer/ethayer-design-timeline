// Document rules for eras.json, site.json, resume.json, and the shape of order.json
// (spec 004 content-json, FR-300, FR-313: `era-ref`, `period`, `url`, `order`).
import { ERA_IDS } from '../era-ids.ts';
import { CONTENT_FILES } from '../paths.ts';
import type {
  EraId,
  Education,
  Era,
  ProjectOrder,
  Resume,
  ResumeIntro,
  ResumeProject,
  ResumeRole,
  Site,
  SiteLink,
} from '../types.ts';
import { type ValidationContext, type Validated, finish } from './issue.ts';
import { readPoster } from './media.ts';
import { ENGAGEMENTS } from './project.ts';
import { type Item, Reader, Sink, each, isOneOf, readHttps, readPeriod, show } from './read.ts';

export type Eras = readonly [Era, ...Era[]];

export const isEraId = (v: unknown): v is EraId => isOneOf(ERA_IDS, v);

function readEra(r: Reader): Era | undefined {
  const id = r.named('id', ERA_IDS, 'era-ref');
  const label = r.string('label');
  const period = readPeriod(r);
  const engagement = r.oneOf('engagement', ENGAGEMENTS);
  if (id === undefined || label === undefined || period === undefined) return undefined;
  if (engagement === undefined) return undefined;
  return { id, label, period, engagement };
}

/** Eras: ids in `ERA_IDS`, unique, newest `period.start` first (FR-001, hero "Now" reads `ERAS[0]`). */
export function validateEras(raw: unknown): Validated<Eras> {
  const sink = new Sink(CONTENT_FILES.eras, null);
  let eras: readonly Era[] | undefined;
  if (Array.isArray(raw)) {
    const items: Item[] = raw.map((value: unknown, i) => ({ value, path: `/${String(i)}` }));
    eras = each(items, sink, 'An era', readEra);
  } else sink.report('shape', '', `eras.json must be an array, got ${show(raw)}`);

  const [first, ...rest] = eras ?? [];
  if (eras !== undefined && first === undefined) {
    sink.report('shape', '', 'eras.json must list at least one era');
  }
  const seen = new Set<string>();
  (eras ?? []).forEach((era, i) => {
    if (seen.has(era.id)) sink.report('era-ref', `/${String(i)}/id`, `"${era.id}" is listed twice`);
    seen.add(era.id);
    const prev = eras?.[i - 1];
    if (prev !== undefined && prev.period.start < era.period.start) {
      sink.report(
        'era-ref',
        `/${String(i)}/period/start`,
        `"${era.id}" starts ${era.period.start}, after "${prev.id}" (${prev.period.start}); list eras newest first`,
      );
    }
  });
  return finish(first === undefined ? undefined : [first, ...rest], sink.issues);
}

const isSiteHref = (s: string): s is SiteLink['href'] =>
  s === '/resume' || s.startsWith('mailto:') || (s.startsWith('https://') && URL.canParse(s));

function readSiteLink(r: Reader): SiteLink | undefined {
  const label = r.string('label');
  const href = r.string('href');
  if (label === undefined || href === undefined) return undefined;
  if (isSiteHref(href)) return { label, href };
  r.error('url', 'href', `"${href}" must be /resume, an https:// URL, or a mailto: link`);
  return undefined;
}

function readEducation(r: Reader): Education | undefined {
  const degree = r.string('degree');
  const school = r.string('school');
  const year = r.string('year');
  if (degree === undefined || school === undefined || year === undefined) return undefined;
  return { degree, school, year };
}

/** Identity, links, and education (`site.json`). */
export function validateSite(raw: unknown): Validated<Site> {
  const sink = new Sink(CONTENT_FILES.site, null);
  const r = Reader.open(raw, '', sink, 'site.json');
  let site: Site | undefined;
  if (r !== undefined) {
    const name = r.string('name');
    const role = r.string('role');
    const location = r.string('location');
    const summary = r.string('summary');
    const span = readPeriod(r, 'span');
    const links = each(r.items('links'), sink, 'A link', readSiteLink);
    const education = each(r.items('education'), sink, 'An education entry', readEducation);
    r.done();
    if (
      name !== undefined &&
      role !== undefined &&
      location !== undefined &&
      summary !== undefined
    ) {
      if (span !== undefined && links !== undefined && education !== undefined) {
        site = { name, role, location, summary, span, links, education };
      }
    }
  }
  return finish(site, sink.issues);
}

const CAPTIONS = /^\/captions\/[a-z0-9-]+\.vtt$/;
const isCaptions = (s: string): s is ResumeIntro['captions'] => CAPTIONS.test(s);

function readIntro(r: Reader, ctx: ValidationContext): ResumeIntro | undefined {
  const src = r.string('src');
  if (src !== undefined && ctx.videoKeys !== null && !ctx.videoKeys.has(src)) {
    r.error('media-key', 'src', `"${src}" is not in video-manifest.json`);
  }
  const poster = readPoster(r, ctx);
  const captions = r.string('captions');
  if (captions !== undefined && !isCaptions(captions)) {
    r.error('url', 'captions', `"${captions}" must look like /captions/<name>.vtt`);
  }
  const title = r.text('title', 'Intro title');
  const durationSec = r.number('durationSec');
  if (src === undefined || poster === undefined || captions === undefined) return undefined;
  if (!isCaptions(captions) || title === undefined || durationSec === undefined) return undefined;
  return { src, poster, captions, title, durationSec };
}

function readRole(r: Reader): ResumeRole | undefined {
  const role = r.string('role');
  const company = r.string('company');
  const location = r.string('location');
  const period = readPeriod(r);
  const summary = r.string('summary');
  const highlights = r.strings('highlights');
  const href = readHttps(r, 'href', true);
  if (role === undefined || company === undefined || location === undefined) return undefined;
  if (period === undefined || summary === undefined || highlights === undefined) return undefined;
  return {
    role,
    company,
    location,
    period,
    summary,
    highlights,
    ...(href === undefined ? {} : { href }),
  };
}

function readResumeProject(r: Reader): ResumeProject | undefined {
  const title = r.string('title');
  const detail = r.string('detail');
  const year = r.string('year');
  const href = readHttps(r, 'href', true);
  if (title === undefined || detail === undefined || year === undefined) return undefined;
  return { title, detail, year, ...(href === undefined ? {} : { href }) };
}

function readProficiencies(r: Reader): Resume['proficiencies'] | undefined {
  const p = r.object('proficiencies');
  if (p === undefined) return undefined;
  const development = p.strings('development');
  const software = p.strings('software');
  p.done();
  if (development === undefined || software === undefined) return undefined;
  return { development, software };
}

/** The HTML résumé (`resume.json`, spec 002 FR-120). */
export function validateResume(raw: unknown, ctx: ValidationContext): Validated<Resume> {
  const sink = new Sink(CONTENT_FILES.resume, null);
  const r = Reader.open(raw, '', sink, 'resume.json');
  let resume: Resume | undefined;
  if (r !== undefined) {
    const headline = r.string('headline');
    const summary = r.string('summary');
    const i = r.optionalObject('intro');
    const intro = i === undefined ? undefined : readIntro(i, ctx);
    i?.done();
    const experience = each(r.items('experience'), sink, 'A role', readRole);
    const skills = r.strings('skills');
    const proficiencies = readProficiencies(r);
    const projects = each(r.items('projects'), sink, 'A project', readResumeProject);
    r.done();
    const hasIntro = i !== undefined;
    if (headline !== undefined && summary !== undefined && (intro !== undefined || !hasIntro)) {
      if (experience !== undefined && skills !== undefined) {
        if (proficiencies !== undefined && projects !== undefined) {
          resume = {
            headline,
            summary,
            ...(intro === undefined ? {} : { intro }),
            experience,
            skills,
            proficiencies,
            projects,
          };
        }
      }
    }
  }
  return finish(resume, sink.issues);
}

/** The shape of `order.json`: `EraId` keys (rule `order`) holding arrays of slugs (FR-301). */
export function validateOrder(raw: unknown): Validated<ProjectOrder> {
  const sink = new Sink(CONTENT_FILES.order, null);
  const r = Reader.open(raw, '', sink, 'order.json');
  const order: { [E in EraId]?: readonly string[] } = {};
  let complete = r !== undefined;
  for (const key of r?.keys() ?? []) {
    if (!isEraId(key)) {
      r?.error('order', key, `"${key}" is not an era id`);
      complete = false;
      continue;
    }
    const slugs = r?.strings(key);
    if (slugs === undefined) complete = false;
    else order[key] = slugs;
  }
  return finish(complete ? order : undefined, sink.issues);
}
