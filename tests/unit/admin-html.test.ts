import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const index = readFileSync('index.html', 'utf8');
const admin = readFileSync('admin.html', 'utf8');
const toml = readFileSync('netlify.toml', 'utf8');

const body = (html: string): string => /<body>[\s\S]*<\/body>/.exec(html)?.[0] ?? '';
const head = (html: string): string => /<head>[\s\S]*<\/head>/.exec(html)?.[0] ?? '';

describe('admin.html entry (spec 004 FR-340, FR-344)', () => {
  it('retains the editor timeline navigation while the public shell gains Overview', () => {
    expect(body(admin)).toContain('data-view="experience" aria-current="page"');
    expect(body(admin)).not.toContain('data-view="overview"');
    expect(body(index)).toContain('data-view="overview" aria-current="page"');
    for (const shell of [admin, index]) {
      expect(body(shell)).toContain('<main id="main" tabindex="-1">');
      expect(body(shell)).toContain('<motion-toggle></motion-toggle>');
    }
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
