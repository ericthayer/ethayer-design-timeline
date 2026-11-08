/** Site origin for absolute URLs in canonical and social tags (FR-132). */
export const FALLBACK_ORIGIN = 'https://work.ethayer.design';

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

/** The Netlify subdomain that visitors and old links still use (FR-610). */
export const LEGACY_ORIGIN = 'https://ethayer-design.netlify.app';

/**
 * A domain-level redirect from the Netlify subdomain to the primary origin (FR-610). Written only
 * on production builds, so a preview or branch deploy never redirects the production subdomain.
 */
export function renderLegacyRedirect(origin: string, context: string | undefined): string {
  if (context !== 'production' || origin === LEGACY_ORIGIN) return '';
  return `${LEGACY_ORIGIN}/* ${origin}/:splat 301!\n`;
}
