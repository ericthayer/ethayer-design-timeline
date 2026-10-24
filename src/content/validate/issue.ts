// Issue model for the content validator (spec 004 content-json, FR-305, FR-306, FR-313).
// Pure TS: no DOM and no `node:*`, so tests, the build, and the editor share it.

/** Every rule the validator reports (FR-313). Order follows the rule table. */
export const RULE_IDS = [
  'json-parse',
  'shape',
  'unknown-key',
  'slug',
  'text-length',
  'size-media',
  'gallery-media',
  'a11y-text',
  'placeholder-caption',
  'focal-format',
  'period',
  'era-ref',
  'theme-name',
  'motif-name',
  'url',
  'iframe-host',
  'media-key',
  'video-duration',
  'order',
  'swiss-share',
  'standard-run',
  'swiss-motif-unique',
] as const;

export type RuleId = (typeof RULE_IDS)[number];
export type Severity = 'error' | 'warning';

/** Editorial composition rules across projects are warnings; everything else is an error (FR-312). */
const WARNINGS: ReadonlySet<RuleId> = new Set<RuleId>([
  'swiss-share',
  'standard-run',
  'swiss-motif-unique',
]);

export const severityOf = (rule: RuleId): Severity => (WARNINGS.has(rule) ? 'warning' : 'error');

export interface Issue {
  readonly severity: Severity;
  readonly rule: RuleId;
  /** Repo path, e.g. `src/content/data/projects/dmns.json`. */
  readonly file: string;
  /** RFC 6901 JSON Pointer into the file, e.g. `/gallery/2/label`; `''` is the whole file. */
  readonly path: string;
  readonly slug: string | null;
  /** Plain text that names the value and the limit. */
  readonly message: string;
}

export type Validated<T> =
  | { readonly ok: true; readonly value: T; readonly warnings: readonly Issue[] }
  | { readonly ok: false; readonly errors: readonly Issue[]; readonly warnings: readonly Issue[] };

/** Parsed JSON, as `unknown`, keyed by repo path (FR-305). Unparsable files hold a `JsonParseFailure`. */
export type RawContent = Readonly<Record<string, unknown>>;

/** Facts from outside the content (FR-305). `null` skips that manifest check. */
export interface ValidationContext {
  readonly mediaKeys: ReadonlySet<string> | null;
  readonly videoKeys: ReadonlySet<string> | null;
  readonly frameOrigins: readonly string[];
}

export function issue(
  rule: RuleId,
  file: string,
  path: string,
  slug: string | null,
  message: string,
): Issue {
  return { severity: severityOf(rule), rule, file, path, slug, message };
}

/** RFC 6901: `~` → `~0`, `/` → `~1`. */
export const pointer = (base: string, key: string | number): string =>
  `${base}/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`;

/** `ok` only when there is a value and no error. Warnings never set `ok: false` (FR-312). */
export function finish<T>(value: T | undefined, issues: readonly Issue[]): Validated<T> {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  if (value !== undefined && errors.length === 0) return { ok: true, value, warnings };
  return { ok: false, errors, warnings };
}

/** Marks a file whose text is not valid JSON, so `validateContent` reports `json-parse` (FR-311). */
export class JsonParseFailure {
  readonly reason: string;
  constructor(reason: string) {
    this.reason = reason;
  }
}

/** `JSON.parse` that never throws: a bad file becomes a `JsonParseFailure`. */
export function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch (error) {
    return new JsonParseFailure(error instanceof Error ? error.message : String(error));
  }
}
