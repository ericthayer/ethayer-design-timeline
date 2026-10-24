// Content validator (spec 004 content-json): issue model, readers, and paths (FR-305–FR-308).
import { describe, expect, it } from 'vitest';
import { CONTENT_FILES, projectFile, serialize, slugOfFile } from '../../src/content/paths.ts';
import {
  JsonParseFailure,
  finish,
  issue,
  parseJson,
  pointer,
} from '../../src/content/validate/issue.ts';
import { validateProject } from '../../src/content/validate/project.ts';
import { Reader, Sink, readPeriod } from '../../src/content/validate/read.ts';
import {
  CTX,
  ERA_REF_PROJECT,
  PROJECT_FIXTURES,
  type ProjectFixture,
  type ProjectRule,
  baseProject,
} from '../fixtures/content/projects.ts';

const FILE = 'src/content/data/projects/demo.json';

function read(value: unknown, fn: (r: Reader) => void): Sink {
  const sink = new Sink(FILE, 'demo');
  const r = Reader.open(value, '', sink, 'project');
  if (r) {
    fn(r);
    r.done();
  }
  return sink;
}

describe('issue model (FR-306)', () => {
  it('escapes JSON Pointer segments (RFC 6901)', () => {
    expect(pointer('', 'gallery')).toBe('/gallery');
    expect(pointer('/gallery', 2)).toBe('/gallery/2');
    expect(pointer('', 'a/b~c')).toBe('/a~1b~0c');
  });

  it('keeps ok on warnings and drops the value on errors (FR-312)', () => {
    const warn = issue('swiss-share', FILE, '', null, 'w');
    const err = issue('shape', FILE, '/title', 'demo', 'e');
    expect(warn.severity).toBe('warning');
    expect(err.severity).toBe('error');
    expect(finish(1, [warn])).toEqual({ ok: true, value: 1, warnings: [warn] });
    expect(finish(1, [warn, err])).toEqual({ ok: false, errors: [err], warnings: [warn] });
  });

  it('turns unparsable JSON into a JsonParseFailure (FR-311)', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson('{')).toBeInstanceOf(JsonParseFailure);
  });
});

describe('readers (FR-307)', () => {
  it('reports missing, mistyped, null, and unknown keys with pointers', () => {
    const sink = read({ title: 3, extra: true, seed: null }, (r) => {
      r.string('title');
      r.string('client');
      r.optionalNumber('seed');
    });
    expect(sink.issues.map((i) => [i.rule, i.path])).toEqual([
      ['shape', '/title'],
      ['shape', '/client'],
      ['shape', '/seed'],
      ['unknown-key', '/extra'],
    ]);
    expect(sink.issues.every((i) => i.file === FILE && i.slug === 'demo')).toBe(true);
  });

  it('omits absent optional keys instead of setting undefined', () => {
    const sink = read({}, (r) => {
      expect(r.optionalString('focal')).toBeUndefined();
    });
    expect(sink.issues).toEqual([]);
  });

  it('checks periods: real months and start ≤ end', () => {
    const periods: [unknown, string | null][] = [
      [{ start: '2020-01', end: 'present' }, null],
      [{ start: '2020-13', end: 'present' }, '/period/start'],
      [{ start: '2021-01', end: '2020-12' }, '/period/end'],
    ];
    for (const [period, path] of periods) {
      const sink = read({ period }, (r) => readPeriod(r));
      expect(sink.issues.map((i) => i.path)).toEqual(path === null ? [] : [path]);
    }
  });
});

describe('paths (FR-308)', () => {
  it('maps slugs to files and back', () => {
    expect(projectFile('dmns')).toBe('src/content/data/projects/dmns.json');
    expect(slugOfFile(projectFile('dmns'))).toBe('dmns');
    expect(slugOfFile(CONTENT_FILES.order)).toBeNull();
  });

  it('serializes as two-space JSON with a trailing newline', () => {
    expect(serialize({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}\n');
  });
});

describe('validateProject (FR-313 per-file rules)', () => {
  const file = projectFile('demo');

  it('accepts the base project and rebuilds it without stray keys', () => {
    const result = validateProject(baseProject('demo'), file, CTX);
    expect(result).toStrictEqual({ ok: true, value: baseProject('demo'), warnings: [] });
  });

  const cases = Object.entries(PROJECT_FIXTURES) as [ProjectRule, ProjectFixture][];
  it.each([...cases, ['era-ref', ERA_REF_PROJECT] as const])(
    '%s: reports rule, severity, file, path, and slug',
    (rule, fixture) => {
      const result = validateProject(fixture.project, file, CTX);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors).toEqual([
        expect.objectContaining({
          rule,
          severity: 'error',
          file,
          path: fixture.path,
          slug: 'demo',
        }),
      ]);
    },
  );

  it('skips manifest checks when the manifest is unknown (null)', () => {
    const { project } = PROJECT_FIXTURES['media-key'];
    const ctx = { ...CTX, mediaKeys: null };
    expect(validateProject(project, file, ctx).ok).toBe(true);
  });

  it('takes a mobile iframe on a tall card and rejects it on a wide card (FR-035)', () => {
    const media = {
      kind: 'iframe',
      src: 'https://demo.netlify.app/',
      title: 'Live demo',
      viewport: 'mobile',
      poster: { kind: 'image', src: 'demo/cover', alt: 'Poster' },
    };
    expect(validateProject(baseProject('demo', { size: 'tall', media }), file, CTX).ok).toBe(true);
    const wide = validateProject(baseProject('demo', { size: 'wide', media }), file, CTX);
    expect(wide.ok ? [] : wide.errors.map((i) => [i.rule, i.path])).toEqual([
      ['size-media', '/media/viewport'],
    ]);
  });
});
