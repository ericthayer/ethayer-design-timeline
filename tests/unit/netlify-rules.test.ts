// netlify.toml rules for launch (spec 007, FR-616, FR-622, FR-630).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const toml = readFileSync('netlify.toml', 'utf8');

/** The `[[headers]]` block for one path, or undefined. */
function headerBlock(path: string): string | undefined {
  return toml
    .split('[[headers]]')
    .slice(1)
    .find((block) => block.includes(`for = "${path}"`));
}

describe('redirects (spec 007, FR-616, FR-622)', () => {
  it('drops the /work/* and /resume rules, so prerendered pages and the 404 page decide', () => {
    expect(toml).not.toContain('from = "/work/*"');
    expect(toml).not.toContain('from = "/resume"');
  });

  it('keeps the admin rewrites', () => {
    expect(toml).toContain('from = "/admin/*"');
  });
});

describe('cache headers (spec 007, FR-630)', () => {
  const policy = 'Cache-Control = "public, max-age=86400, stale-while-revalidate=604800"';

  it.each(['/og/*', '/media/*', '/fonts/*'])('gives %s a one-day cache, not immutable', (path) => {
    const block = headerBlock(path);
    expect(block, path).toContain(policy);
    expect(block, path).not.toContain('immutable');
  });

  it('leaves /assets/* on its hashed-name policy', () => {
    expect(headerBlock('/assets/*')).toContain(
      'Cache-Control = "public, max-age=31536000, immutable"',
    );
  });
});
