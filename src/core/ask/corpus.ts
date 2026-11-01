import type { About, AskChips } from '../../content/ask.ts';
import type { Era, Period, Project, Resume, Site } from '../../content/types.ts';

/** What the Ask corpus is built from (spec 005, FR-430): validated content only. */
export interface CorpusInput {
  readonly site: Site;
  readonly resume: Resume;
  readonly eras: readonly Era[];
  /** In `order.json` order. Drafts are dropped here. */
  readonly projects: readonly Project[];
  readonly ask: AskChips;
  readonly about: About;
}

const period = (p: Period): string => `${p.start} to ${p.end}`;

/** `Label: value` lines, skipping empty values. */
function lines(fields: readonly (readonly [string, string | undefined])[]): string[] {
  return fields.flatMap(([label, value]) =>
    value === undefined || value.trim() === '' ? [] : [`${label}: ${value.trim()}`],
  );
}

const block = (tag: string, attrs: string, body: readonly string[]): string =>
  [`<${tag}${attrs}>`, ...body, `</${tag}>`].join('\n');

function siteBlock(site: Site): string {
  return block('about-eric', '', [
    ...lines([
      ['Name', site.name],
      ['Role', site.role],
      ['Location', site.location],
      ['Summary', site.summary],
      ['Career span', period(site.span)],
      ['Highlights', site.highlights.join(', ')],
      ['Contact links', site.links.map((l) => l.label).join(', ')],
    ]),
    ...site.education.map((e) => `Education: ${e.degree}, ${e.school}, ${e.year}`),
  ]);
}

function resumeBlock(resume: Resume): string {
  const roles = resume.experience.map((r) =>
    [
      ...lines([
        ['Role', `${r.role} at ${r.company} (${r.location}), ${period(r.period)}`],
        ['Summary', r.summary],
      ]),
      ...r.highlights.map((h) => `- ${h.trim()}`),
    ].join('\n'),
  );
  return block('resume', '', [
    ...lines([
      ['Headline', resume.headline],
      ['Summary', resume.summary],
      ['Skills', resume.skills.join(', ')],
      ['Development', resume.proficiencies.development.join(', ')],
      ['Software', resume.proficiencies.software.join(', ')],
    ]),
    ...roles,
    ...resume.projects.map((p) => `Side project: ${p.title} (${p.year}): ${p.detail}`),
  ]);
}

function projectBlock(p: Project, eras: ReadonlyMap<string, string>): string {
  return block('project', ` slug="${p.slug}"`, [
    ...lines([
      ['Title', p.title],
      ['Client', p.client],
      ['Era', eras.get(p.era) ?? p.era],
      ['Engagement', p.engagement],
      ['Role', p.role],
      ['Period', period(p.period)],
      ['Summary', p.summary],
      ['Context', p.body.context],
      ['Contribution', p.body.contribution],
      ['Outcome', p.body.outcome],
      [
        'Tags',
        p.tracklist
          .map((t) => (t.value === undefined ? t.label : `${t.label} ${t.value}`))
          .join(', '),
      ],
      ['Links', (p.links ?? []).map((l) => l.label).join(', ')],
    ]),
    ...(p.metrics ?? []).map((m) => `Metric: ${m.value} ${m.label}`),
  ]);
}

/**
 * The Ask corpus (FR-430): plain text, fields in a fixed order, drafts excluded, no timestamps.
 * The same content always gives byte-identical output, so the prompt-cache prefix stays stable.
 */
export function buildCorpus(input: CorpusInput): string {
  const eraLabels = new Map(input.eras.map((e) => [e.id, e.label]));
  const projects = input.projects.filter((p) => p.draft !== true);
  return [
    siteBlock(input.site),
    ...input.about.sections.map((s) =>
      block('about', ` id="${s.id}" topic="${s.topic}"`, [`Title: ${s.title}`, s.text.trim()]),
    ),
    resumeBlock(input.resume),
    block(
      'eras',
      '',
      input.eras.map((e) => `${e.label} (${e.engagement}), ${period(e.period)}`),
    ),
    ...projects.map((p) => projectBlock(p, eraLabels)),
    ...input.ask.chips.map((c) =>
      block('written-answer', ` id="${c.id}" topic="${c.topic}"`, [
        `Question: ${c.label}`,
        ...c.answer.map((a) => a.trim()),
        ...lines([['Related projects', c.related.join(', ')]]),
      ]),
    ),
  ].join('\n\n');
}
