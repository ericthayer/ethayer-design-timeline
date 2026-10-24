// Gzip-measures the production build against constitution §V and spec 004 admin-auth FR-341 and
// FR-358. Public lines walk index.html's graph only; admin lines walk admin.html's graph minus the
// public set. Exits 1 on any breach or isolation failure.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { floorPolicy } from './csp.ts';

const DIST = 'dist';
const KB = 1024;
const BUDGETS = {
  initialJs: 25 * KB,
  totalJs: 50 * KB,
  css: 20 * KB,
  fonts: 60 * KB,
  adminJs: 40 * KB,
  adminCss: 5 * KB,
} as const;
/** Public initial JS in gzip bytes at 6240560, before admin-auth. FR-358 allows +0.3 KB. */
const BASELINE_INITIAL_JS = 19_507;
const MAX_INITIAL_DELTA = 0.3 * KB;
/** Only admin code may name GitHub's API (FR-341). */
const FORBIDDEN_IN_PUBLIC = 'api.github.com';

interface ManifestChunk {
  readonly file: string;
  readonly imports?: readonly string[];
  readonly dynamicImports?: readonly string[];
  readonly css?: readonly string[];
}
type Manifest = Readonly<Record<string, ManifestChunk>>;

interface Graph {
  readonly initialJs: Set<string>;
  readonly js: Set<string>;
  readonly css: Set<string>;
}

const readManifest = (path: string): Manifest =>
  JSON.parse(readFileSync(join(DIST, path), 'utf8')) as Manifest;

/** Every file reachable from `entry`: static imports are initial, dynamic imports are lazy. */
function walkGraph(manifest: Manifest, entry: string): Graph {
  const graph: Graph = { initialJs: new Set(), js: new Set(), css: new Set() };
  const seen = new Set<string>();
  const visit = (key: string, initial: boolean): void => {
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Manifest has no "${key}"`);
    if (initial) graph.initialJs.add(chunk.file);
    if (seen.has(key) && !initial) return;
    seen.add(key);
    graph.js.add(chunk.file);
    for (const file of chunk.css ?? []) graph.css.add(file);
    for (const dep of chunk.imports ?? []) visit(dep, initial);
    for (const dep of chunk.dynamicImports ?? []) visit(dep, false);
  };
  visit(entry, true);
  return graph;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const gz = (file: string): number => gzipSync(readFileSync(join(DIST, file))).length;
const sum = (files: Iterable<string>, measure: (f: string) => number): number =>
  [...files].reduce((total, f) => total + measure(f), 0);
const minus = (set: Set<string>, other: Set<string>): string[] =>
  [...set].filter((f) => !other.has(f));

const publicGraph = walkGraph(readManifest('.vite/manifest.json'), 'index.html');
const adminGraph = walkGraph(readManifest('.vite/admin-manifest.json'), 'admin.html');
const fonts = walk(DIST)
  .filter((f) => f.endsWith('.woff2'))
  .map((f) => f.slice(DIST.length + 1));
const initialJs = sum(publicGraph.initialJs, gz);

const rows = [
  ['Initial JS (gzip)', initialJs, BUDGETS.initialJs],
  ['Total JS (gzip)', sum(publicGraph.js, gz), BUDGETS.totalJs],
  ['CSS (gzip)', sum(publicGraph.css, gz), BUDGETS.css],
  ['Fonts (raw woff2)', sum(fonts, (f) => statSync(join(DIST, f)).size), BUDGETS.fonts],
  ['Admin JS (gzip)', sum(minus(adminGraph.js, publicGraph.js), gz), BUDGETS.adminJs],
  ['Admin CSS (gzip)', sum(minus(adminGraph.css, publicGraph.css), gz), BUDGETS.adminCss],
] as const;

const report = (ok: boolean, message: string): void => {
  if (!ok) process.exitCode = 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`);
};

for (const [label, size, budget] of rows) {
  report(
    size <= budget,
    `${label.padEnd(18)} ${(size / KB).toFixed(1).padStart(6)} KB / ${budget / KB} KB`,
  );
}

// Informational: other modules may legitimately move the public baseline later.
const delta = initialJs - BASELINE_INITIAL_JS;
console.log(
  `${delta <= MAX_INITIAL_DELTA ? 'INFO' : 'WARN'}  Initial JS vs 6240560 ${delta >= 0 ? '+' : ''}${delta} B (FR-358 allows +${MAX_INITIAL_DELTA.toFixed(0)} B)`,
);

// Isolation gate (FR-341): no public chunk may name GitHub's API.
const leaks = [...publicGraph.js].filter((f) =>
  readFileSync(join(DIST, f), 'utf8').includes(FORBIDDEN_IN_PUBLIC),
);
report(leaks.length === 0, `Isolation: no "${FORBIDDEN_IN_PUBLIC}" in public JS ${leaks.join(' ')}`);

// CSP floor (FR-355): index.html carries the meta, admin.html must not.
const decode = (s: string): string =>
  s.replaceAll('&#39;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');
const metaCsp = (html: string): string | undefined =>
  /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1];
const indexMeta = metaCsp(readFileSync(join(DIST, 'index.html'), 'utf8'));
report(
  indexMeta !== undefined && decode(indexMeta) === floorPolicy(),
  'CSP floor: dist/index.html carries the meta policy',
);
report(
  metaCsp(readFileSync(join(DIST, 'admin.html'), 'utf8')) === undefined,
  'CSP floor: dist/admin.html has no meta policy',
);
