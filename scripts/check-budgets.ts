// Gzip-measures the production build against constitution §V. Exits 1 on any breach.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const KB = 1024;
const BUDGETS = { initialJs: 25 * KB, totalJs: 50 * KB, css: 20 * KB, fonts: 60 * KB } as const;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const gz = (path: string): number => gzipSync(readFileSync(path)).length;
const files = walk(DIST);
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const initialRefs = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);

const js = files.filter((f) => f.endsWith('.js'));
const initialJs = js.filter((f) => initialRefs.includes(relative(DIST, f)));
const css = files.filter((f) => f.endsWith('.css'));
const fonts = files.filter((f) => f.endsWith('.woff2'));

const sum = (list: string[], measure: (f: string) => number): number =>
  list.reduce((total, f) => total + measure(f), 0);

const rows = [
  ['Initial JS (gzip)', sum(initialJs, gz), BUDGETS.initialJs],
  ['Total JS (gzip)', sum(js, gz), BUDGETS.totalJs],
  ['CSS (gzip)', sum(css, gz), BUDGETS.css],
  ['Fonts (raw woff2)', sum(fonts, (f) => statSync(f).size), BUDGETS.fonts],
] as const;

let failed = false;
for (const [label, size, budget] of rows) {
  const ok = size <= budget;
  failed ||= !ok;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(18)} ${(size / KB).toFixed(1).padStart(6)} KB / ${budget / KB} KB`,
  );
}
process.exit(failed ? 1 : 0);
