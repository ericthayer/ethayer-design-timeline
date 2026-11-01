// The Ask wire protocol (spec 005, FR-417, FR-418, FR-436), shared by the client and the function.
// Pure TS: no DOM and no `node:*`.

export const ASK_PROTOCOL_VERSION = 1;

/** FR-417 and FR-436 caps. */
export const ASK_CAPS = {
  bodyBytes: 8 * 1024,
  question: 500,
  userTurn: 500,
  assistantTurn: 2000,
  historyTurns: 6,
} as const;

export interface Turn {
  readonly role: 'user' | 'assistant';
  readonly text: string;
  /** HMAC of an assistant turn the function wrote (FR-438). */
  readonly sig?: string;
}

export interface AskRequest {
  readonly v: typeof ASK_PROTOCOL_VERSION;
  readonly question: string;
  readonly history: readonly Turn[];
}

export const ASK_ERROR_CODES = [
  'invalid',
  'rate-limited',
  'unavailable',
  'over-budget',
  'declined',
] as const;
export type AskErrorCode = (typeof ASK_ERROR_CODES)[number];

export type AskEvent =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'end'; readonly reason: 'complete' | 'truncated'; readonly sig: string }
  | { readonly type: 'error'; readonly code: AskErrorCode };

export type Parsed<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

type Json = Readonly<Record<string, unknown>>;
const isRecord = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const onlyKeys = (o: Json, keys: readonly string[]): boolean =>
  Object.keys(o).every((k) => keys.includes(k));
const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

function safeJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}

function parseTurn(v: unknown, i: number): Parsed<Turn> {
  if (!isRecord(v) || !onlyKeys(v, ['role', 'text', 'sig'])) return fail(`history[${i}] shape`);
  const { role, text, sig } = v;
  if (role !== 'user' && role !== 'assistant') return fail(`history[${i}].role`);
  if (!isString(text) || text.trim() === '') return fail(`history[${i}].text`);
  const max = role === 'user' ? ASK_CAPS.userTurn : ASK_CAPS.assistantTurn;
  if (text.length > max) return fail(`history[${i}].text is over ${max} characters`);
  if (sig !== undefined && !isString(sig)) return fail(`history[${i}].sig`);
  return { ok: true, value: sig === undefined ? { role, text } : { role, text, sig } };
}

/** Validates a POST body (FR-436). Never throws. */
export function parseAskRequest(body: string): Parsed<AskRequest> {
  if (new TextEncoder().encode(body).length > ASK_CAPS.bodyBytes) return fail('body too large');
  const v = safeJson(body);
  if (!isRecord(v) || !onlyKeys(v, ['v', 'question', 'history'])) return fail('shape');
  if (v['v'] !== ASK_PROTOCOL_VERSION) return fail('version');
  const question = v['question'];
  if (!isString(question) || question.trim() === '') return fail('question');
  if (question.length > ASK_CAPS.question)
    return fail(`question is over ${ASK_CAPS.question} characters`);
  const raw = v['history'];
  if (!Array.isArray(raw)) return fail('history');
  if (raw.length > ASK_CAPS.historyTurns)
    return fail(`history is over ${ASK_CAPS.historyTurns} turns`);
  const history: Turn[] = [];
  for (const [i, item] of raw.entries()) {
    const turn = parseTurn(item, i);
    if (!turn.ok) return turn;
    history.push(turn.value);
  }
  return { ok: true, value: { v: ASK_PROTOCOL_VERSION, question, history } };
}

/** One event as an NDJSON line. */
export const encodeEvent = (event: AskEvent): string => `${JSON.stringify(event)}\n`;

const isErrorCode = (v: unknown): v is AskErrorCode =>
  isString(v) && ASK_ERROR_CODES.some((c) => c === v);

/** One NDJSON line → event, or `null` for anything not in the FR-418 union. */
export function parseEvent(line: string): AskEvent | null {
  const v = safeJson(line);
  if (!isRecord(v)) return null;
  switch (v['type']) {
    case 'text':
      return onlyKeys(v, ['type', 'text']) && isString(v['text'])
        ? { type: 'text', text: v['text'] }
        : null;
    case 'end': {
      const { reason, sig } = v;
      if (!onlyKeys(v, ['type', 'reason', 'sig']) || !isString(sig)) return null;
      return reason === 'complete' || reason === 'truncated' ? { type: 'end', reason, sig } : null;
    }
    case 'error':
      return onlyKeys(v, ['type', 'code']) && isErrorCode(v['code'])
        ? { type: 'error', code: v['code'] }
        : null;
    default:
      return null;
  }
}

/**
 * Incremental NDJSON decoder for a streamed response (FR-418). Chunks may split lines and
 * multi-byte UTF-8 sequences anywhere. Lines that aren't valid events are counted, not returned.
 */
export class EventDecoder {
  rejected = 0;
  private readonly decoder = new TextDecoder();
  private buffer = '';

  push(chunk: Uint8Array): AskEvent[] {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    return this.parse(lines);
  }

  /** Flushes the last line when the stream ends without a trailing newline. */
  end(): AskEvent[] {
    const rest = this.buffer + this.decoder.decode();
    this.buffer = '';
    return this.parse([rest]);
  }

  private parse(lines: readonly string[]): AskEvent[] {
    const events: AskEvent[] = [];
    for (const line of lines) {
      if (line.trim() === '') continue;
      const event = parseEvent(line);
      if (event === null) this.rejected += 1;
      else events.push(event);
    }
    return events;
  }
}
