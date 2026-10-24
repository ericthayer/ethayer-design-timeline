/**
 * Content-Security-Policy, the single source (spec 004 admin-auth FR-355).
 *
 * - The `/*` response header is the **ceiling**: the public policy plus GitHub in `connect-src`
 *   and `blob:` in `img-src`, which only `admin.html` uses.
 * - The build injects the **floor** into `index.html` as a `<meta>`: the public policy without
 *   `frame-ancestors` (meta can't carry it; the header keeps it). Browsers enforce both, so
 *   public pages stay at `connect-src 'self'` and `img-src 'self'`.
 *
 * No `node:*` imports: the editor imports `FRAME_SRC` from here (edit-layer X2, lint-enforced).
 */
export const FRAME_SRC = [
  'https://qrlanding.netlify.app',
  'https://dmns.netlify.app',
  'https://madramps.com',
  'https://player.vimeo.com',
] as const;

export const GITHUB_API = 'https://api.github.com';

type Directive = readonly [name: string, sources: readonly string[]];

const SELF = ["'self'"] as const;

const PUBLIC: readonly Directive[] = [
  ['default-src', SELF],
  ['script-src', SELF],
  ['style-src', SELF],
  ['img-src', SELF],
  ['media-src', SELF],
  ['font-src', SELF],
  ['connect-src', SELF],
  ['frame-src', FRAME_SRC],
  ['object-src', ["'none'"]],
  ['base-uri', SELF],
  ['form-action', SELF],
  ['frame-ancestors', ["'none'"]],
];

/** Sources the admin page needs on top of the public policy. */
const CEILING_EXTRA: Readonly<Record<string, readonly string[]>> = {
  'img-src': ['blob:'],
  'connect-src': [GITHUB_API],
};

const META_UNSUPPORTED = new Set(['frame-ancestors', 'report-uri', 'sandbox']);

const serialize = (directives: readonly Directive[]): string =>
  directives.map(([name, sources]) => [name, ...sources].join(' ')).join('; ');

/** Today's public policy (what every public page effectively enforces). */
export function publicPolicy(): string {
  return serialize(PUBLIC);
}

/** The `/*` header in netlify.toml. */
export function ceilingPolicy(): string {
  return serialize(
    PUBLIC.map(([name, sources]) => [name, [...sources, ...(CEILING_EXTRA[name] ?? [])]] as const),
  );
}

/** The `<meta http-equiv="Content-Security-Policy">` injected into `dist/index.html` only. */
export function floorPolicy(): string {
  return serialize(PUBLIC.filter(([name]) => !META_UNSUPPORTED.has(name)));
}
