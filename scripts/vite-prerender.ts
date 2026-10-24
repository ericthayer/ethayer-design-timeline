/**
 * Vite plugin: after `vite build`, turns dist/index.html into one page per route (ADR-9).
 * It runs inside Vite, so Netlify's build needs no extra tooling or Node features.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { ERAS } from '../src/content/eras.ts';
import { PROJECTS } from '../src/content/projects/index.ts';
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
      const pages = buildPages({ projects: PROJECTS, eras: ERAS, manifest });

      for (const page of pages) write(join(outDir, page.file), applyPage(shell, page, origin));
      write(join(outDir, 'sitemap.xml'), renderSitemap(pages, origin));
      write(join(outDir, 'robots.txt'), renderRobots(origin));
      write(join(outDir, '_redirects'), renderRedirects(pages));
      config.logger.info(`prerendered ${String(pages.length)} pages for ${origin}`);
    },
  };
}
