import { defineConfig } from 'vitest/config';
import { prerender } from './scripts/vite-prerender.ts';

export default defineConfig({
  plugins: [prerender()],
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
