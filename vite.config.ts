import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { floorPolicy } from './scripts/csp.ts';

/**
 * Public CSP floor (spec 004 admin-auth FR-355): a <meta> policy in dist/index.html only, ahead
 * of every script. Build only, so dev keeps Vite's injected styles working (plan §5).
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

export default defineConfig({
  plugins: [cspFloor()],
  build: {
    target: 'es2023',
    // Inline data: URIs would need a looser CSP, so every asset is emitted as a file.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
  },
});
