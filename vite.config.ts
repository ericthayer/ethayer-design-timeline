import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, type BuildEnvironmentOptions, type Connect, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { floorPolicy } from './scripts/csp.ts';

const SHARED_BUILD = {
  target: 'es2023',
  // Inline data: URIs would need a looser CSP, so every asset is emitted as a file.
  assetsInlineLimit: 0,
  modulePreload: { polyfill: false },
} satisfies BuildEnvironmentOptions;

/** Where `npm run budgets` finds each graph (spec 004 admin-auth FR-341, FR-358). */
export const PUBLIC_MANIFEST = '.vite/manifest.json';
export const ADMIN_MANIFEST = '.vite/admin-manifest.json';

/**
 * Public CSP floor (FR-355): a <meta> policy in dist/index.html only, ahead of every script.
 * Build only, so dev keeps Vite's injected styles working (plan §5).
 */
function cspFloor(): Plugin {
  return {
    name: 'csp-floor',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (ctx.path !== '/index.html') return;
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: floorPolicy() },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}

const ADMIN_PATH = /^\/admin(?:\/|$)/;

/** `/admin` and `/admin/*` serve admin.html in dev and preview, as netlify.toml does (FR-340). */
function adminRewrite(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const path = (req.url ?? '').split('?')[0] ?? '';
    if (ADMIN_PATH.test(path)) req.url = '/admin.html';
    next();
  };
  return {
    name: 'admin-rewrite',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

interface ManifestChunk {
  readonly file: string;
  readonly css?: readonly string[];
}

/**
 * admin.html boots the **built** public entry by URL after sign-in, so its head gets that
 * entry's stylesheet (the sign-in page renders before boot, plan §4 V7) and a modulepreload
 * the entry script reads. A separate graph keeps public chunks byte-identical (FR-341, FR-358).
 */
function adminHead(entry: ManifestChunk): Plugin {
  return {
    name: 'admin-head',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (ctx.path !== '/admin.html') return;
        return [
          ...(entry.css ?? []).map((file) => ({
            tag: 'link',
            attrs: { rel: 'stylesheet', crossorigin: true, href: `/${file}` },
            injectTo: 'head-prepend' as const,
          })),
          {
            tag: 'link',
            attrs: {
              rel: 'modulepreload',
              crossorigin: true,
              href: `/${entry.file}`,
              'data-public-entry': true,
            },
            injectTo: 'head' as const,
          },
        ];
      },
    },
  };
}

/** After the public build, build admin.html as its own graph into the same dist. */
function adminBuild(): Plugin {
  let root = process.cwd();
  let outDir = 'dist';
  return {
    name: 'admin-build',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const manifest = JSON.parse(
        readFileSync(resolve(outDir, PUBLIC_MANIFEST), 'utf8'),
      ) as Record<string, ManifestChunk>;
      const entry = manifest['index.html'];
      if (!entry) throw new Error('admin-build: the public manifest has no index.html entry');
      await build({
        configFile: false,
        root,
        publicDir: false,
        logLevel: 'warn',
        plugins: [adminHead(entry)],
        build: {
          ...SHARED_BUILD,
          outDir,
          emptyOutDir: false,
          copyPublicDir: false,
          manifest: ADMIN_MANIFEST,
          rolldownOptions: { input: { admin: resolve(root, 'admin.html') } },
        },
      });
    },
  };
}

export default defineConfig({
  plugins: [cspFloor(), adminRewrite(), adminBuild()],
  build: { ...SHARED_BUILD, manifest: PUBLIC_MANIFEST },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
  },
});
