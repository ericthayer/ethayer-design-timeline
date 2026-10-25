import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const index = readFileSync('index.html', 'utf8');
const admin = readFileSync('admin.html', 'utf8');
const toml = readFileSync('netlify.toml', 'utf8');

const body = (html: string): string => /<body>[\s\S]*<\/body>/.exec(html)?.[0] ?? '';
const head = (html: string): string => /<head>[\s\S]*<\/head>/.exec(html)?.[0] ?? '';

describe('admin.html entry (spec 004 FR-340, FR-344)', () => {
  it('has a body byte-identical to index.html', () => {
    expect(body(admin)).not.toBe('');
    expect(body(admin)).toBe(body(index));
  });

  it('differs in the head only by title, robots meta, and entry script', () => {
    const normalize = (html: string): string =>
      head(html)
        .replace(/<title>[^<]*<\/title>/, '<title/>')
        .replace(/\s*<meta name="robots"[^>]*>/, '')
        .replace(/src="\/src\/[^"]+"/, 'src="entry"');
    expect(normalize(admin)).toBe(normalize(index));
    expect(admin).toContain('<title>Admin — Eric Thayer</title>');
    expect(admin).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(admin).toContain('<script type="module" src="/src/admin/entry.ts"></script>');
  });

  it('is never linked from the public page', () => {
    expect(index).not.toMatch(/href="\/admin/);
  });

  it('netlify rewrites /admin and /admin/* to admin.html with a 200', () => {
    for (const from of ['/admin', '/admin/*']) {
      expect(toml).toMatch(
        new RegExp(`from = "${from.replace('*', '\\*')}"\\s+to = "/admin.html"\\s+status = 200`),
      );
    }
  });

  it('sends X-Robots-Tag noindex on every admin path', () => {
    for (const path of ['/admin', '/admin/*', '/admin.html']) {
      expect(toml).toMatch(
        new RegExp(
          `for = "${path.replace('*', '\\*')}"\\s+\\[headers.values\\]\\s+X-Robots-Tag = "noindex, nofollow"`,
        ),
      );
    }
  });
});
