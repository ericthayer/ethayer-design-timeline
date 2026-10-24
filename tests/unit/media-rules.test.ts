import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  checkSource,
  findDuplicateKeys,
  mediaKeyFromPath,
  parseSourcePath,
  type SourceRef,
} from '../../src/core/media-rules.ts';

const source = (path: string): SourceRef => {
  const parsed = parseSourcePath(path);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed;
};

describe('parseSourcePath (FR-320, FR-322)', () => {
  it('parses a valid image and video source', () => {
    expect(parseSourcePath('media-src/dmns/cover.webp')).toEqual({
      ok: true,
      kind: 'image',
      path: 'media-src/dmns/cover.webp',
      slug: 'dmns',
      name: 'cover',
      ext: 'webp',
      key: 'dmns/cover',
    });
    const clip = parseSourcePath('media-src/merchants/clip.mp4');
    expect(clip.ok && clip.kind).toBe('video');
  });

  it('accepts every supported extension', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'avif', 'mp4', 'webm']) {
      expect(parseSourcePath(`media-src/a/b.${ext}`).ok, ext).toBe(true);
    }
  });

  it.each([
    ['media-src/dmns/cover.PNG', 'media-src/dmns/cover.PNG: extension .PNG must be lowercase'],
    ['media-src/dmns/sub/cover.png', 'media-src/dmns/sub/cover.png: nested too deep'],
    ['media-src/cover.png', 'media-src/cover.png: must be inside a <slug>/ folder'],
    ['media-src/dmns/Cover.png', 'media-src/dmns/Cover.png: name "Cover" must be lowercase'],
    ['media-src/dmns/cover_1.png', 'name "cover_1"'],
    ['media-src/DMNS/cover.png', 'folder "DMNS"'],
    ['media-src/dmns/cover', 'missing file extension'],
    ['media-src/dmns/cover.gif', 'media-src/dmns/cover.gif: unsupported extension .gif'],
    ['public/media/dmns/cover.png', 'must be under media-src/'],
  ])('rejects %s', (path, message) => {
    const parsed = parseSourcePath(path);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.ignored).toBe(false);
    expect(parsed.error).toContain(message);
    expect(parsed.error.startsWith(`${path}: `)).toBe(true);
  });

  it('ignores dotfiles anywhere below the root', () => {
    for (const path of ['media-src/.DS_Store', 'media-src/dmns/.DS_Store', 'media-src/.git/x']) {
      const parsed = parseSourcePath(path);
      expect(!parsed.ok && parsed.ignored, path).toBe(true);
    }
  });
});

describe('mediaKeyFromPath (FR-321)', () => {
  it('maps a source to its manifest key', () => {
    expect(mediaKeyFromPath('media-src/dmns/cover.webp')).toBe('dmns/cover');
    expect(mediaKeyFromPath('media-src/hs-vue-library/cover.png')).toBe('hs-vue-library/cover');
    expect(mediaKeyFromPath('media-src/merchants/clip.webm')).toBe('merchants/clip');
    expect(mediaKeyFromPath('media-src/dmns/cover.gif')).toBeUndefined();
  });
});

describe('findDuplicateKeys (FR-321)', () => {
  it('flags two image sources with one key, naming both files', () => {
    const errors = findDuplicateKeys([
      source('media-src/dmns/cover.png'),
      source('media-src/dmns/cover.webp'),
      source('media-src/sublist/cover.webp'),
    ]);
    expect(errors).toEqual([
      'media-src/dmns/cover.png: duplicate key dmns/cover (cover.png, cover.webp)',
      'media-src/dmns/cover.webp: duplicate key dmns/cover (cover.png, cover.webp)',
    ]);
  });

  it('does not treat a clip pair as a duplicate', () => {
    expect(
      findDuplicateKeys([source('media-src/m/clip.mp4'), source('media-src/m/clip.webm')]),
    ).toEqual([]);
  });
});

describe('checkSource (FR-322)', () => {
  const png = source('media-src/dmns/cover.png');
  const mp4 = source('media-src/merchants/clip.mp4');

  it('passes a source inside every limit', () => {
    expect(checkSource(png, { bytes: 1000, width: 1920, height: 1200 })).toEqual({ ok: true });
    expect(checkSource(mp4, { bytes: LIMITS.maxVideoBytes })).toEqual({ ok: true });
  });

  it('rejects a file over 10 MB', () => {
    const result = checkSource(png, { bytes: LIMITS.maxImageBytes + 1, width: 1920, height: 1200 });
    expect(result).toEqual({
      ok: false,
      errors: ['media-src/dmns/cover.png: 10.0 MB, maximum is 10.0 MB'],
    });
  });

  it('rejects an image narrower than 480 px', () => {
    expect(checkSource(png, { bytes: 1000, width: 320, height: 200 })).toEqual({
      ok: false,
      errors: ['media-src/dmns/cover.png: 320 px wide, minimum is 480'],
    });
    expect(checkSource(png, { bytes: 1000, width: 480, height: 300 }).ok).toBe(true);
  });

  it('rejects more than 50 MP decoded', () => {
    const result = checkSource(png, { bytes: 1000, width: 10_000, height: 5001 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('50.0 MP decoded, maximum is 50 MP');
    expect(checkSource(png, { bytes: 1000, width: 10_000, height: 5000 }).ok).toBe(true);
  });

  it('reports every problem on its own line', () => {
    const result = checkSource(png, { bytes: 11 * 1024 * 1024, width: 100, height: 600_000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(3);
  });

  it('rejects an image with no readable size', () => {
    expect(checkSource(png, { bytes: 1000 })).toEqual({
      ok: false,
      errors: ['media-src/dmns/cover.png: could not read the image size'],
    });
  });

  it('rejects a clip over 1.5 MB', () => {
    const result = checkSource(mp4, { bytes: LIMITS.maxVideoBytes + 1 });
    expect(result.ok).toBe(false);
  });
});
