// Build gate (spec 004 content-json, FR-310, FR-311): validates src/content/data/** and exits 1
// on any error, so Netlify keeps the last good deploy. Warnings print but never fail the build.
//   npm run content:check
import { pathToFileURL } from 'node:url';
import { type Issue, validateContent } from '../src/content/validate/index.ts';
import { readContext, readRawContent } from './content-fs.ts';

/** `error <file> <pointer> <rule>: <message>`. The whole-file pointer `''` prints as `(root)`. */
export const formatIssue = (i: Issue): string =>
  `${i.severity} ${i.file} ${i.path === '' ? '(root)' : i.path} ${i.rule}: ${i.message}`;

/** Validates the content under `root`, prints every issue, and returns the exit code. */
export function run(root: string, log: (line: string) => void = console.log): number {
  const result = validateContent(readRawContent(root), readContext(root));
  const errors = result.ok ? [] : result.errors;
  for (const i of [...errors, ...result.warnings]) log(formatIssue(i));
  log(`content:check: ${errors.length} error(s), ${result.warnings.length} warning(s)`);
  return errors.length > 0 || !result.ok ? 1 : 0;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exit(run(process.cwd()));
}
