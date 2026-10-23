// Theme contrast recomputed from tokens.css (FR-015, constitution IV.5).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/content/themes.ts';

const css = readFileSync('src/styles/tokens.css', 'utf8');
const swatches = new Map(
  [...css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1] ?? '', m[2] ?? '']),
);

function themeVars(theme: string): Map<string, string> {
  const block = new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  return new Map(
    [...block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [
      m[1] ?? '',
      (m[2] ?? '').trim(),
    ]),
  );
}

function resolve(value: string): string {
  const ref = /^var\(--([a-z-]+)\)$/.exec(value)?.[1];
  const hex = ref ? swatches.get(ref) : value;
  if (!hex?.startsWith('#')) throw new Error(`Unresolvable color: ${value}`);
  return hex;
}

function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme contrast', () => {
  it.each(THEMES)('%s: body text ≥ 4.5:1 and title ≥ 3:1', (theme) => {
    const vars = themeVars(theme);
    const bg = resolve(vars.get('bg') ?? '');
    const fg = resolve(vars.get('fg') ?? '');
    const title = resolve(vars.get('title') ?? vars.get('fg') ?? '');
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(title, bg)).toBeGreaterThanOrEqual(3);
  });

  it('keeps standard label chips AA (ink and graphite on paper)', () => {
    const paper = swatches.get('paper') ?? '';
    expect(contrast(swatches.get('ink') ?? '', paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(swatches.get('graphite') ?? '', paper)).toBeGreaterThanOrEqual(4.5);
  });
});
