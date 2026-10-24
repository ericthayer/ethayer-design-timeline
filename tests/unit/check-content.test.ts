// Build gate (spec 004 content-json, FR-310, FR-311): `run(root)` prints issues, exit 1 on errors.
// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run } from '../../scripts/check-content.ts';
import { serialize } from '../../src/content/paths.ts';
import { RULE_FIXTURES } from '../fixtures/content/bundle.ts';

function capture(root: string): { code: number; lines: string[] } {
  const lines: string[] = [];
  const code = run(root, (line) => lines.push(line));
  return { code, lines };
}

const temp = mkdtempSync(join(tmpdir(), 'content-check-'));
afterAll(() => {
  rmSync(temp, { recursive: true, force: true });
});

describe('check-content run(root)', () => {
  it('exits 1 on the bad fixtures with `error <file> <pointer> <rule>: …` lines', () => {
    const { code, lines } = capture('tests/fixtures/content/bad');
    expect(code).toBe(1);
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^error src\/content\/data\/projects\/demo\.json \/media\/alt a11y-text: /,
      ),
    );
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^error src\/content\/data\/projects\/broken\.json \(root\) json-parse: /,
      ),
    );
  });

  it('prints warnings but exits 0 when there are no errors', () => {
    for (const [file, value] of Object.entries(RULE_FIXTURES['swiss-share'].raw())) {
      mkdirSync(dirname(join(temp, file)), { recursive: true });
      writeFileSync(join(temp, file), serialize(value));
    }
    const { code, lines } = capture(temp);
    expect(code).toBe(0);
    expect(lines).toContainEqual(
      expect.stringMatching(/^warning src\/content\/data\/order\.json \(root\) swiss-share: /),
    );
  });

  it('passes the real content', () => {
    expect(capture('.').code).toBe(0);
  });
});
