// Release bump for the tag-on-merge workflow (.github/workflows/release.yml).
//
//   node scripts/next-version.ts v1.2.3 "feat(admin): add a gallery (#42)"
//
// Prints the next tag, or nothing when the commit doesn't warrant a release. The version lives in
// git tags, not package.json, so no bot commits land on main. The editor's own publish commits
// ("content: update dmns via admin") use the `content` type and never release.
import { pathToFileURL } from 'node:url';

export type Bump = 'major' | 'minor' | 'patch';

const SUBJECT = /^(?<type>[a-z]+)(?:\([^)]*\))?(?<breaking>!)?: \S/;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: /m;
const TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

/** The bump a Conventional Commit message calls for, or `null` for chore, docs, ci, content, etc. */
export function bumpFor(message: string): Bump | null {
  const subject = message.split('\n', 1)[0] ?? '';
  const match = SUBJECT.exec(subject);
  if (!match?.groups) return null;
  if (match.groups['breaking'] || BREAKING_FOOTER.test(message)) return 'major';
  const type = match.groups['type'];
  if (type === 'feat') return 'minor';
  if (type === 'fix' || type === 'perf') return 'patch';
  return null;
}

/** The tag after `current` for this bump, or `null` when `current` isn't a `vX.Y.Z` tag. */
export function nextTag(current: string, bump: Bump): string | null {
  const match = TAG.exec(current);
  if (!match) return null;
  const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (bump === 'major') return `v${major + 1}.0.0`;
  if (bump === 'minor') return `v${major}.${minor + 1}.0`;
  return `v${major}.${minor}.${patch + 1}`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [current = '', message = ''] = process.argv.slice(2);
  const bump = bumpFor(message);
  const tag = bump ? nextTag(current, bump) : null;
  if (bump && !tag) {
    console.error(`"${current}" is not a vX.Y.Z tag.`);
    process.exitCode = 1;
  } else if (tag) {
    console.log(tag);
  }
}
