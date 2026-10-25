/**
 * Vite plugin: after `vite build`, turns dist/index.html into one page per route (ADR-9).
 * It runs inside Vite, so Netlify's build needs no extra tooling or Node features.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { validateContent } from '../src/content/validate/index.ts';
import { readContext, readRawContent } from './content-fs.ts';
import { resolveOrigin } from './lib/origin.ts';
import {
  applyPage,
  buildPages,
  renderRedirects,
  renderRobots,
  renderSitemap,
  type MediaManifest,
} from './lib/pages.ts';

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export function prerender(): Plugin {
  let config: ResolvedConfig | undefined;
  return {
    name: 'ethayer:prerender',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      if (!config) return;
      const outDir = join(config.root, config.build.outDir);
      const shell = readFileSync(join(outDir, 'index.html'), 'utf8');
      const manifest = JSON.parse(
        readFileSync(join(config.root, 'src/content/media-manifest.json'), 'utf8'),
      ) as MediaManifest;
      const origin = resolveOrigin(process.env);
      // Read content through the validator (spec 004 content-json), not the src/content loaders:
      // projects/index.ts uses import.meta.glob, which only Vite's transform understands.
      const content = validateContent(readRawContent(config.root), readContext(config.root));
      if (!content.ok) throw new Error('prerender: content is invalid; run npm run content:check');
      const { projects, eras } = content.value;
      const pages = buildPages({ projects, eras, manifest });

      for (const page of pages) write(join(outDir, page.file), applyPage(shell, page, origin));
      write(join(outDir, 'sitemap.xml'), renderSitemap(pages, origin));
      write(join(outDir, 'robots.txt'), renderRobots(origin));
      write(join(outDir, '_redirects'), renderRedirects(pages));
      config.logger.info(`prerendered ${String(pages.length)} pages for ${origin}`);
    },
  };
}
