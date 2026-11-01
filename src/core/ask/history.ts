import type { AskChip } from '../../content/ask.ts';
import { ASK_CAPS, type Turn } from './protocol.ts';

/**
 * The history sent with a question (FR-417): the last 6 turns, starting with a visitor turn,
 * because the Messages API needs the first message to be the user's.
 */
export function trimHistory(turns: readonly Turn[]): Turn[] {
  const recent = turns.slice(-ASK_CAPS.historyTurns);
  const start = recent.findIndex((t) => t.role === 'user');
  return start === -1 ? [] : recent.slice(start);
}

/** A chip's question and Eric's answer as turns. The function verifies the answer against ask.json (FR-438). */
export function chipTurns(chip: AskChip): [Turn, Turn] {
  return [
    { role: 'user', text: chip.label },
    { role: 'assistant', text: chip.answer.join('\n\n') },
  ];
}

/** An assistant turn from a finished stream, with the signature from its `end` event. */
export const answerTurn = (text: string, sig: string): Turn => ({ role: 'assistant', text, sig });
