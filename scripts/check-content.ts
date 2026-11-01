// Build gate (spec 004 content-json, FR-310, FR-311; spec 005 FR-410, FR-435): validates
// src/content/data/** and exits 1 on any error, so Netlify keeps the last good deploy.
// Warnings print but never fail the build.
//   npm run content:check
import { pathToFileURL } from 'node:url';
import {
  type Issue,
  askProjectsOf,
  validateAskContent,
  validateContent,
} from '../src/content/validate/index.ts';
import { readAskContent, readContext, readRawContent } from './content-fs.ts';

/** `error <file> <pointer> <rule>: <message>`. The whole-file pointer `''` prints as `(root)`. */
export const formatIssue = (i: Issue): string =>
  `${i.severity} ${i.file} ${i.path === '' ? '(root)' : i.path} ${i.rule}: ${i.message}`;

/** Validates the content under `root`, prints every issue, and returns the exit code. */
export function run(root: string, log: (line: string) => void = console.log): number {
  const result = validateContent(readRawContent(root), readContext(root));
  // Ask chips link to projects, so they are checked only against a valid bundle (spec 005).
  const ask = result.ok
    ? validateAskContent(readAskContent(root), askProjectsOf(result.value.projects))
    : [];
  const issues = [...(result.ok ? [] : result.errors), ...result.warnings, ...ask];
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.length - errors.length;
  for (const i of [...errors, ...issues.filter((i) => i.severity === 'warning')]) log(formatIssue(i));
  log(`content:check: ${errors.length} error(s), ${warnings} warning(s)`);
  return errors.length > 0 || !result.ok ? 1 : 0;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exit(run(process.cwd()));
}
