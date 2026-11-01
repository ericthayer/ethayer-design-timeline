// Rules for Ask content (spec 005, FR-410, FR-435): `ask.json` chips and the `about.json` corpus.
// Reuses the shared rule ids: `slug` for ids and references, `text-length` for limits.
import { ASK_TOPICS, type About, type AboutSection, type AskChip, type AskChips } from '../ask.ts';
import { ASK_FILES } from '../paths.ts';
import { type Validated, finish } from './issue.ts';
import { Reader, Sink, each, isString, show } from './read.ts';

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** FR-410 and FR-435 limits. */
export const ASK_LIMITS = {
  label: 60,
  paragraph: 600,
  /** Joined with blank lines; matches the protocol's assistant-turn cap (FR-417). */
  answer: 2000,
  maxChips: 16,
  aboutChars: 12_000,
} as const;

/** The projects chips may link to: every slug, and which of them are drafts (FR-410). */
export interface AskProjects {
  readonly slugs: ReadonlySet<string>;
  readonly drafts: ReadonlySet<string>;
}

function readId(r: Reader): string | undefined {
  const id = r.string('id');
  if (id !== undefined && !ID.test(id)) {
    r.error('slug', 'id', `"${id}" must be kebab-case (a-z, 0-9, -)`);
  }
  return id;
}

/** An array of non-empty strings, each at most `max` characters. */
function readTexts(
  r: Reader,
  key: string,
  what: string,
  max: number,
): readonly string[] | undefined {
  const items = r.items(key);
  if (items === undefined) return undefined;
  const out: string[] = [];
  for (const item of items) {
    const v = item.value;
    if (!isString(v)) {
      r.sink.report('shape', item.path, `must be a string, got ${show(v)}`);
      continue;
    }
    if (v.trim().length === 0) r.sink.report('a11y-text', item.path, `${what} must not be empty`);
    if (v.length > max) {
      r.sink.report(
        'text-length',
        item.path,
        `${what} is ${v.length} characters, the limit is ${max}`,
      );
    }
    out.push(v);
  }
  return out.length === items.length ? out : undefined;
}

function readRelated(r: Reader, projects: AskProjects): readonly string[] | undefined {
  const related = r.strings('related');
  related?.forEach((slug, i) => {
    const at = `${r.at('related')}/${String(i)}`;
    if (!projects.slugs.has(slug)) r.sink.report('slug', at, `"${slug}" is not a project`);
    else if (projects.drafts.has(slug)) {
      r.sink.report('slug', at, `"${slug}" is a draft, so Ask can't link to it`);
    }
  });
  return related;
}

function readChip(r: Reader, projects: AskProjects): AskChip | undefined {
  const id = readId(r);
  const label = r.text('label', 'A chip label');
  if (label !== undefined && label.length > ASK_LIMITS.label) {
    r.error(
      'text-length',
      'label',
      `"label" is ${label.length} characters, the limit is ${ASK_LIMITS.label}`,
    );
  }
  const topic = r.oneOf('topic', ASK_TOPICS);
  const answer = readTexts(r, 'answer', 'An answer paragraph', ASK_LIMITS.paragraph);
  if (answer?.length === 0)
    r.error('a11y-text', 'answer', 'An answer needs at least one paragraph');
  const joined = answer?.join('\n\n').length ?? 0;
  if (joined > ASK_LIMITS.answer) {
    r.error(
      'text-length',
      'answer',
      `The answer is ${joined} characters, the limit is ${ASK_LIMITS.answer}`,
    );
  }
  const related = readRelated(r, projects);
  const followups = r.strings('followups');
  if (id === undefined || label === undefined || topic === undefined) return undefined;
  if (answer === undefined || related === undefined || followups === undefined) return undefined;
  return { id, label, topic, answer, related, followups };
}

/** Ids are unique (rule `slug`), and every follow-up names another chip that exists. */
function checkIds(chips: readonly AskChip[], sink: Sink): void {
  const ids = new Set<string>();
  chips.forEach((chip, i) => {
    if (ids.has(chip.id))
      sink.report('slug', `/chips/${String(i)}/id`, `"${chip.id}" is listed twice`);
    ids.add(chip.id);
  });
  chips.forEach((chip, i) => {
    chip.followups.forEach((ref, j) => {
      const at = `/chips/${String(i)}/followups/${String(j)}`;
      if (ref === chip.id) sink.report('slug', at, `"${chip.id}" can't follow up with itself`);
      else if (!ids.has(ref)) sink.report('slug', at, `"${ref}" is not a chip id`);
    });
  });
}

/** Suggestion chips (`ask.json`, FR-410). */
export function validateAsk(raw: unknown, projects: AskProjects): Validated<AskChips> {
  const sink = new Sink(ASK_FILES.ask, null);
  const r = Reader.open(raw, '', sink, 'ask.json');
  let value: AskChips | undefined;
  if (r !== undefined) {
    const items = r.items('chips');
    const chips = each(items, sink, 'A chip', (c) => readChip(c, projects));
    r.done();
    if (items !== undefined && (items.length === 0 || items.length > ASK_LIMITS.maxChips)) {
      sink.report(
        'shape',
        '/chips',
        `ask.json lists ${items.length} chips; it needs 1 to ${ASK_LIMITS.maxChips}`,
      );
    }
    if (chips !== undefined) {
      checkIds(chips, sink);
      value = { chips };
    }
  }
  return finish(value, sink.issues);
}

function readSection(r: Reader): AboutSection | undefined {
  const id = readId(r);
  const topic = r.oneOf('topic', ASK_TOPICS);
  const title = r.text('title', 'A section title');
  const text = r.text('text', 'A section');
  if (id === undefined || topic === undefined || title === undefined || text === undefined) {
    return undefined;
  }
  return { id, topic, title, text };
}

/** The about corpus (`about.json`, FR-435): unique ids, and at most 12,000 characters in all. */
export function validateAbout(raw: unknown): Validated<About> {
  const sink = new Sink(ASK_FILES.about, null);
  const r = Reader.open(raw, '', sink, 'about.json');
  let value: About | undefined;
  if (r !== undefined) {
    const sections = each(r.items('sections'), sink, 'A section', readSection);
    r.done();
    if (sections !== undefined) {
      const ids = new Set<string>();
      sections.forEach((s, i) => {
        if (ids.has(s.id))
          sink.report('slug', `/sections/${String(i)}/id`, `"${s.id}" is listed twice`);
        ids.add(s.id);
      });
      const chars = sections.reduce((n, s) => n + s.title.length + s.text.length, 0);
      if (chars > ASK_LIMITS.aboutChars) {
        sink.report(
          'text-length',
          '/sections',
          `about.json is ${chars} characters, the limit is ${ASK_LIMITS.aboutChars}`,
        );
      }
      value = { sections };
    }
  }
  return finish(value, sink.issues);
}
