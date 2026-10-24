// Readers over parsed JSON (spec 004 content-json, FR-306, FR-307). They narrow `unknown` with
// type predicates only, track the JSON Pointer, collect issues, and reject unknown keys.
import type { Focal, Period, YearMonth } from '../types.ts';
import { type Issue, JsonParseFailure, type RuleId, issue, pointer } from './issue.ts';

export type Json = Readonly<Record<string, unknown>>;

export const isRecord = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof JsonParseFailure);
export const isString = (v: unknown): v is string => typeof v === 'string';
export const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
export const isOneOf = <T extends string>(values: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && values.some((value) => value === v);

/** A short, plain-text rendering of a value for messages. */
export function show(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'an array';
  if (typeof v === 'object') return 'an object';
  if (typeof v === 'string') return `"${v.length > 40 ? `${v.slice(0, 40)}…` : v}"`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return typeof v === 'undefined' ? 'nothing' : `a ${typeof v}`;
}

/** Collects the issues for one file. */
export class Sink {
  readonly issues: Issue[] = [];
  readonly file: string;
  slug: string | null;

  constructor(file: string, slug: string | null) {
    this.file = file;
    this.slug = slug;
  }

  report(rule: RuleId, path: string, message: string): void {
    this.issues.push(issue(rule, this.file, path, this.slug, message));
  }
}

/** One JSON array element, before it is narrowed. */
export interface Item {
  readonly value: unknown;
  readonly path: string;
}

/** Reads one JSON object. Call `done()` after the last field to report unknown keys. */
export class Reader {
  readonly path: string;
  readonly sink: Sink;
  private readonly raw: Json;
  private readonly seen = new Set<string>();

  private constructor(raw: Json, path: string, sink: Sink) {
    this.raw = raw;
    this.path = path;
    this.sink = sink;
  }

  /** A reader for `value`, or `undefined` (and a `shape` error) when it is not an object. */
  static open(value: unknown, path: string, sink: Sink, what: string): Reader | undefined {
    if (isRecord(value)) return new Reader(value, path, sink);
    sink.report('shape', path, `${what} must be an object, got ${show(value)}`);
    return undefined;
  }

  at(key: string | number): string {
    return pointer(this.path, key);
  }

  error(rule: RuleId, key: string | number | null, message: string): void {
    this.sink.report(rule, key === null ? this.path : this.at(key), message);
  }

  /** The raw value of `key`, marking it as known. Absent keys are `undefined`. */
  value(key: string): unknown {
    this.seen.add(key);
    return Object.hasOwn(this.raw, key) ? this.raw[key] : undefined;
  }

  has(key: string): boolean {
    return this.value(key) !== undefined;
  }

  private field<T>(
    key: string,
    optional: boolean,
    guard: (v: unknown) => v is T,
    type: string,
  ): T | undefined {
    const v = this.value(key);
    if (v === undefined) {
      if (!optional) this.error('shape', key, `missing required field "${key}" (${type})`);
      return undefined;
    }
    if (guard(v)) return v;
    this.error('shape', key, `"${key}" must be ${type}, got ${show(v)}`);
    return undefined;
  }

  string(key: string): string | undefined {
    return this.field(key, false, isString, 'a string');
  }

  optionalString(key: string): string | undefined {
    return this.field(key, true, isString, 'a string');
  }

  number(key: string): number | undefined {
    return this.field(key, false, isNumber, 'a number');
  }

  optionalNumber(key: string): number | undefined {
    return this.field(key, true, isNumber, 'a number');
  }

  optionalBoolean(key: string): boolean | undefined {
    return this.field(key, true, isBoolean, 'true or false');
  }

  oneOf<T extends string>(key: string, values: readonly T[]): T | undefined {
    return this.field(key, false, (v): v is T => isOneOf(values, v), `one of ${values.join(', ')}`);
  }

  optionalOneOf<T extends string>(key: string, values: readonly T[]): T | undefined {
    return this.field(key, true, (v): v is T => isOneOf(values, v), `one of ${values.join(', ')}`);
  }

  /** A string checked against `values` with its own rule (theme, motif, era). */
  named<T extends string>(key: string, values: readonly T[], rule: RuleId): T | undefined {
    const v = this.string(key);
    if (v === undefined) return undefined;
    if (isOneOf(values, v)) return v;
    this.error(rule, key, `"${v}" is not a known ${key}`);
    return undefined;
  }

  /** A string that must be non-empty after trimming (rule `a11y-text`, FR-091, FR-210). */
  text(key: string, what: string): string | undefined {
    const v = this.string(key);
    if (v !== undefined && v.trim().length === 0) {
      this.error('a11y-text', key, `${what} must not be empty`);
    }
    return v;
  }

  /** A string at most `max` characters long (rule `text-length`, FR-091). */
  limited(key: string, max: number): string | undefined {
    const v = this.string(key);
    if (v !== undefined && v.length > max) {
      this.error('text-length', key, `"${key}" is ${v.length} characters, the limit is ${max}`);
    }
    return v;
  }

  object(key: string): Reader | undefined {
    const v = this.value(key);
    if (v === undefined) {
      this.error('shape', key, `missing required field "${key}" (an object)`);
      return undefined;
    }
    return Reader.open(v, this.at(key), this.sink, `"${key}"`);
  }

  optionalObject(key: string): Reader | undefined {
    return this.has(key) ? this.object(key) : undefined;
  }

  /** The elements of an array field, or `undefined` when absent (optional) or invalid. */
  items(key: string, optional = false): readonly Item[] | undefined {
    const v = this.field(key, optional, (x): x is readonly unknown[] => Array.isArray(x), 'an array');
    return v?.map((value, i) => ({ value, path: this.at(key) + `/${String(i)}` }));
  }

  /** An array of strings. */
  strings(key: string): readonly string[] | undefined {
    const items = this.items(key);
    if (items === undefined) return undefined;
    const out: string[] = [];
    for (const item of items) {
      if (isString(item.value)) out.push(item.value);
      else this.sink.report('shape', item.path, `must be a string, got ${show(item.value)}`);
    }
    return out.length === items.length ? out : undefined;
  }

  /** Reports every key no reader asked for (rule `unknown-key`, FR-307). */
  done(): void {
    for (const key of Object.keys(this.raw)) {
      if (!this.seen.has(key)) this.error('unknown-key', key, `"${key}" is not a known field`);
    }
  }
}

/** Reads each element of an array with `read`. `undefined` if any element fails. */
export function each<T>(
  items: readonly Item[] | undefined,
  sink: Sink,
  what: string,
  read: (r: Reader, index: number) => T | undefined,
): readonly T[] | undefined {
  if (items === undefined) return undefined;
  const out: T[] = [];
  items.forEach((item, index) => {
    const r = Reader.open(item.value, item.path, sink, what);
    const value = r === undefined ? undefined : read(r, index);
    r?.done();
    if (value !== undefined) out.push(value);
  });
  return out.length === items.length ? out : undefined;
}

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isYearMonth = (s: string): s is YearMonth => YEAR_MONTH.test(s);
const isPeriodEnd = (s: string): s is YearMonth | 'present' => s === 'present' || isYearMonth(s);

/** `{ start, end }` with real months and `start ≤ end` (rule `period`, FR-091). */
export function readPeriod(r: Reader, key = 'period'): Period | undefined {
  const p = r.object(key);
  if (p === undefined) return undefined;
  const start = p.string('start');
  const end = p.string('end');
  p.done();
  if (start === undefined || end === undefined) return undefined;
  if (!isYearMonth(start)) {
    p.error('period', 'start', `"${start}" must be YYYY-MM with a real month`);
    return undefined;
  }
  if (!isPeriodEnd(end)) {
    p.error('period', 'end', `"${end}" must be YYYY-MM with a real month, or "present"`);
    return undefined;
  }
  if (end !== 'present' && start > end) {
    p.error('period', 'end', `ends ${end}, before it starts (${start})`);
    return undefined;
  }
  return { start, end };
}

type Https = `https://${string}`;
const isHttps = (s: string): s is Https => s.startsWith('https://') && URL.canParse(s);

/** An absolute `https://` URL (rule `url`). */
export function readHttps(r: Reader, key: string, optional = false): Https | undefined {
  const v = optional ? r.optionalString(key) : r.string(key);
  if (v === undefined || isHttps(v)) return v;
  r.error('url', key, `"${v}" must be an https:// URL`);
  return undefined;
}

const FOCAL = /^\d{1,3}% \d{1,3}%$/;
const isFocal = (s: string): s is Focal => FOCAL.test(s);

/** An optional CSS focal point such as `30% 40%` (rule `focal-format`, FR-213). */
export function readFocal(r: Reader, key = 'focal'): Focal | undefined {
  const raw = r.optionalString(key);
  if (raw === undefined || isFocal(raw)) return raw;
  r.error('focal-format', key, `"${raw}" must look like "30% 40%"`);
  return undefined;
}
