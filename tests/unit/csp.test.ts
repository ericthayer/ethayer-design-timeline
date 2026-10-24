import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ceilingPolicy, floorPolicy, publicPolicy } from '../../scripts/csp.ts';

const parse = (policy: string): Map<string, string[]> =>
  new Map(
    policy
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter(
        (tokens): tokens is [string, ...string[]] => tokens[0] !== undefined && tokens[0] !== '',
      )
      .map(([name, ...sources]) => [name, sources]),
  );

function headerPolicy(path: string): string | undefined {
  const toml = readFileSync('netlify.toml', 'utf8');
  const blocks = toml.split('[[headers]]').slice(1);
  const block = blocks.find((b) => b.includes(`for = "${path}"`));
  return /Content-Security-Policy = "([^"]+)"/.exec(block ?? '')?.[1];
}

describe('CSP single source (spec 004 FR-355)', () => {
  it('netlify.toml /* header is exactly the ceiling', () => {
    expect(headerPolicy('/*')).toBe(ceilingPolicy());
  });

  it('no other header block sets a CSP (merge behavior is undocumented, ADR-A2)', () => {
    const toml = readFileSync('netlify.toml', 'utf8');
    expect(toml.match(/Content-Security-Policy/g)).toHaveLength(1);
  });

  it('the ceiling is the public policy plus GitHub in connect-src and blob: in img-src', () => {
    const ceiling = parse(ceilingPolicy());
    const pub = parse(publicPolicy());
    expect([...ceiling.keys()]).toEqual([...pub.keys()]);
    for (const [name, sources] of pub) {
      const extra = (ceiling.get(name) ?? []).filter((s) => !sources.includes(s));
      const expected =
        name === 'connect-src' ? ['https://api.github.com'] : name === 'img-src' ? ['blob:'] : [];
      expect(extra, name).toEqual(expected);
    }
  });

  it('the meta floor is the public policy without frame-ancestors', () => {
    const floor = parse(floorPolicy());
    const pub = parse(publicPolicy());
    expect(floor.has('frame-ancestors')).toBe(false);
    pub.delete('frame-ancestors');
    expect(floor).toEqual(pub);
    expect(floor.get('connect-src')).toEqual(["'self'"]);
    expect(floor.get('img-src')).toEqual(["'self'"]);
  });

  it('public policy has no unsafe-inline', () => {
    expect(ceilingPolicy()).not.toContain('unsafe-inline');
  });
});
