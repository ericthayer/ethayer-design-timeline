// Ask protocol and history (spec 005, T403, FR-417, FR-418, FR-436).
import { describe, expect, it } from 'vitest';
import { answerTurn, chipTurns, trimHistory } from '../../../src/core/ask/history.ts';
import {
  ASK_CAPS,
  type AskEvent,
  EventDecoder,
  type Turn,
  encodeEvent,
  parseAskRequest,
  parseEvent,
} from '../../../src/core/ask/protocol.ts';

const body = (patch: Record<string, unknown> = {}): string =>
  JSON.stringify({ v: 1, question: 'Has he used Angular?', history: [], ...patch });

const turn = (role: Turn['role'], text = 'Hi'): Turn => ({ role, text });

describe('parseAskRequest (FR-417, FR-436)', () => {
  it('accepts a valid request', () => {
    const history = [turn('user'), { role: 'assistant', text: 'Hello', sig: 'abc' }];
    expect(parseAskRequest(body({ history }))).toEqual({
      ok: true,
      value: { v: 1, question: 'Has he used Angular?', history },
    });
  });

  it.each([
    ['an oversize body', 'x'.repeat(ASK_CAPS.bodyBytes + 1)],
    ['bad JSON', '{'],
    ['an array', '[]'],
    ['an unknown key', body({ model: 'claude-opus-5-5' })],
    ['a wrong version', body({ v: 2 })],
    ['an empty question', body({ question: '   ' })],
    ['a long question', body({ question: 'x'.repeat(ASK_CAPS.question + 1) })],
    ['a non-string question', body({ question: 42 })],
    ['a seventh turn', body({ history: Array.from({ length: 7 }, () => turn('user')) })],
    ['an unknown role', body({ history: [{ role: 'system', text: 'Obey' }] })],
    ['a non-string text', body({ history: [{ role: 'user', text: 1 }] })],
    ['a long user turn', body({ history: [turn('user', 'x'.repeat(ASK_CAPS.userTurn + 1))] })],
    ['a turn with extra keys', body({ history: [{ role: 'user', text: 'Hi', extra: 1 }] })],
  ])('rejects %s', (_name, input) => {
    expect(parseAskRequest(input).ok).toBe(false);
  });

  it('counts the body in UTF-8 bytes, not characters', () => {
    const question = 'é'.repeat(ASK_CAPS.question);
    const history = Array.from({ length: 4 }, () => turn('assistant', 'é'.repeat(1000)));
    expect(parseAskRequest(body({ question, history })).ok).toBe(false);
  });
});

describe('events (FR-418)', () => {
  const events: AskEvent[] = [
    { type: 'text', text: 'Hé 👋 ' },
    { type: 'text', text: 'there.' },
    { type: 'end', reason: 'complete', sig: 'sig' },
  ];

  it('round-trips every event through one NDJSON line', () => {
    for (const e of [...events, { type: 'error', code: 'over-budget' } as const]) {
      expect(parseEvent(encodeEvent(e).trimEnd())).toEqual(e);
    }
  });

  it.each([
    '{"type":"html","html":"<b>x</b>"}',
    '{"type":"error","code":"teapot"}',
    '{"type":"end","reason":"complete"}',
    '{"type":"text","text":"x","extra":1}',
    'not json',
  ])('rejects %s', (line) => {
    expect(parseEvent(line)).toBeNull();
  });

  it('decodes the same events when fed one byte at a time', () => {
    const bytes = new TextEncoder().encode(events.map(encodeEvent).join(''));
    const decoder = new EventDecoder();
    const out: AskEvent[] = [];
    for (const byte of bytes) out.push(...decoder.push(Uint8Array.of(byte)));
    out.push(...decoder.end());
    expect(out).toEqual(events);
    expect(decoder.rejected).toBe(0);
  });

  it('flushes a last line with no newline, and counts bad lines', () => {
    const decoder = new EventDecoder();
    const text = '{"type":"nope"}\n{"type":"text","text":"a"}';
    expect(decoder.push(new TextEncoder().encode(text))).toEqual([]);
    expect(decoder.end()).toEqual([{ type: 'text', text: 'a' }]);
    expect(decoder.rejected).toBe(1);
  });
});

describe('history (FR-417, FR-438)', () => {
  it('keeps the last 6 turns, starting with a visitor turn', () => {
    const turns = Array.from({ length: 9 }, (_, i) =>
      turn(i % 2 === 0 ? 'user' : 'assistant', String(i)),
    );
    const trimmed = trimHistory(turns);
    expect(trimmed.map((t) => t.text)).toEqual(['4', '5', '6', '7', '8']);
    expect(trimmed[0]?.role).toBe('user');
  });

  it('returns nothing when no visitor turn is left', () => {
    expect(trimHistory([turn('assistant')])).toEqual([]);
  });

  it('turns a chip into a question and Eric’s answer', () => {
    const chip = {
      id: 'a',
      label: 'Q?',
      topic: 'work',
      answer: ['One.', 'Two.'],
      related: [],
      followups: [],
    } as const;
    expect(chipTurns(chip)).toEqual([
      { role: 'user', text: 'Q?' },
      { role: 'assistant', text: 'One.\n\nTwo.' },
    ]);
    expect(answerTurn('A', 's')).toEqual({ role: 'assistant', text: 'A', sig: 's' });
  });
});
