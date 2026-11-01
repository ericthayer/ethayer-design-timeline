// The editor's shipped project data, fetched as static files (spec 004 edit-layer FR-380, FR-384).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadBundled } from '../../../src/admin/edit/bundled.ts';
import { PROJECTS } from '../../../src/content/projects/index.ts';

/** Serves each project file from disk, by the slug at the end of its URL. */
const disk: typeof fetch = (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const slug = /([a-z0-9-]+)\.json(?:\?.*)?$/.exec(url)?.[1] ?? '';
  try {
    const text = readFileSync(`src/content/data/projects/${slug}.json`, 'utf8');
    return Promise.resolve(new Response(text, { status: 200 }));
  } catch {
    return Promise.resolve(new Response('', { status: 404 }));
  }
};

describe('loadBundled', () => {
  it('returns the same projects, in order, as the public bundle', async () => {
    const bundled = await loadBundled(disk);
    expect(bundled.projects.map((p) => p.slug)).toEqual(PROJECTS.map((p) => p.slug));
    expect(bundled.projects).toEqual(PROJECTS);
  });

  it('leaves out a file that fails to load or validate', async () => {
    const broken: typeof fetch = (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('dmns')) return Promise.resolve(new Response('{"slug":1}', { status: 200 }));
      if (url.includes('cobank')) return Promise.reject(new Error('offline'));
      return disk(input);
    };
    const slugs = (await loadBundled(broken)).projects.map((p) => p.slug);
    expect(slugs).not.toContain('dmns');
    expect(slugs.length).toBeGreaterThan(PROJECTS.length - 3);
  });
});
