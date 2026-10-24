/** Site origin for absolute URLs in canonical and social tags (FR-102). */
export const FALLBACK_ORIGIN = 'https://ethayer-design.netlify.app';

type Env = Readonly<Record<string, string | undefined>>;

const firstSet = (...values: (string | undefined)[]): string | undefined =>
  values.find((value) => value !== undefined && value.trim() !== '')?.trim();

/**
 * `SITE_URL` wins. Otherwise Netlify's `URL` on production builds and `DEPLOY_PRIME_URL` on
 * previews and branch deploys. Always https (except localhost), never a trailing slash or path.
 */
export function resolveOrigin(env: Env): string {
  const onNetlifyProduction = env['CONTEXT'] === 'production';
  const candidate =
    firstSet(
      env['SITE_URL'],
      onNetlifyProduction ? env['URL'] : env['DEPLOY_PRIME_URL'],
      env['URL'],
    ) ?? FALLBACK_ORIGIN;
  const url = new URL(candidate);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  return `${local ? url.protocol : 'https:'}//${url.host}`;
}
