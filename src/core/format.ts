import type { Period, YearMonth } from '../content/types.ts';

const year = (ym: YearMonth): string => ym.slice(0, 4);
const yy = (ym: YearMonth): string => ym.slice(2, 4);

/** Poster index numerals (FR-011): ['23_', '→'] or ['17_', '23']. */
export function indexNumerals(period: Period): readonly [string, string] {
  return [`${yy(period.start)}_`, period.end === 'present' ? '→' : yy(period.end)];
}

/** Spoken period for the visually hidden label (FR-012). */
export function periodText(period: Period): string {
  const start = year(period.start);
  if (period.end === 'present') return `${start} to present`;
  const end = year(period.end);
  return start === end ? start : `${start} to ${end}`;
}

/** Compact visible year range: '2021', '2017–2023', '2023–Now'. */
export function yearRange(period: Period): string {
  const start = year(period.start);
  if (period.end === 'present') return `${start}–Now`;
  const end = year(period.end);
  return start === end ? start : `${start}–${end}`;
}

/** Stable 32-bit seed from a string (FNV-1a), used when a project has no explicit seed. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Two-digit counter: 3 → '03'. */
export const pad2 = (n: number): string => String(n).padStart(2, '0');
