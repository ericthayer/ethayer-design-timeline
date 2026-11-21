// PR-only design entry, built after the normal public/admin graphs.
// Netlify's deploy-preview context invokes this; production uses npm run build alone.
import { resolve } from 'node:path';
import { build } from 'vite';

await build({
  configFile: false,
  publicDir: false,
  build: {
    target: 'es2023',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    outDir: 'dist',
    emptyOutDir: false,
    copyPublicDir: false,
    rolldownOptions: {
      input: resolve('docs/design-explorations/homepage/swiss-review.html'),
    },
  },
});
