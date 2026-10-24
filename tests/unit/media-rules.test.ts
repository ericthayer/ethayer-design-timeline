import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  buildManifest,
  buildVideoManifest,
  checkSource,
  cropBox,
  findDuplicateKeys,
  mediaKeyFromPath,
  pairVideos,
  parseSourcePath,
  selectWidths,
  serializeManifest,
  shouldPassthrough,
  type ImageManifestInput,
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

describe('selectWidths (FR-323)', () => {
  it.each([
    [5120, [480, 960, 1440]],
    [1440, [480, 960, 1440]],
    [1400, [480, 960]],
    [480, [480]],
    [479, []],
  ])('%i px → %j, never upscaling', (width, expected) => {
    expect(selectWidths(width)).toEqual(expected);
  });

  it('pairs with checkSource so a 479 px source is an error, not an empty set', () => {
    const png = source('media-src/a/cover.png');
    expect(checkSource(png, { bytes: 1, width: 479, height: 300 }).ok).toBe(false);
  });
});

describe('cropBox (FR-324)', () => {
  it('crops a tall cover from the top to 16:10', () => {
    expect(cropBox('cover', 1440, 4000)).toEqual({
      left: 0,
      top: 0,
      width: 1440,
      height: 900,
      cropped: true,
    });
  });

  it('keeps a tall gallery image portrait', () => {
    expect(cropBox('detail', 1000, 2000)).toMatchObject({ height: 2000, cropped: false });
  });

  it('leaves wide and exact 16:10 covers unchanged', () => {
    expect(cropBox('cover', 1440, 810)).toMatchObject({ height: 810, cropped: false });
    expect(cropBox('cover', 2774, 1734)).toMatchObject({ height: 1734, cropped: false });
  });
});

describe('shouldPassthrough (FR-325)', () => {
  const base = {
    ext: 'webp',
    format: 'webp',
    cropped: false,
    reoriented: false,
    sourceWidth: 1440,
    targetWidth: 1440,
  } as const;

  it('copies a same-format, same-width, uncropped source', () => {
    expect(shouldPassthrough(base)).toBe(true);
    expect(shouldPassthrough({ ...base, ext: 'avif', format: 'avif' })).toBe(true);
  });

  it('re-encodes otherwise', () => {
    expect(shouldPassthrough({ ...base, format: 'avif' })).toBe(false);
    expect(shouldPassthrough({ ...base, targetWidth: 960 })).toBe(false);
    expect(shouldPassthrough({ ...base, cropped: true })).toBe(false);
    expect(shouldPassthrough({ ...base, reoriented: true })).toBe(false);
    expect(shouldPassthrough({ ...base, ext: 'png' })).toBe(false);
  });
});

describe('pairVideos (FR-322, FR-329)', () => {
  it('accepts a complete pair and names the missing format', () => {
    const result = pairVideos([
      source('media-src/merchants/clip.webm'),
      source('media-src/merchants/clip.mp4'),
      source('media-src/dmns/loop.mp4'),
      source('media-src/dmns/cover.webp'),
    ]);
    expect(result.keys).toEqual(['merchants/clip']);
    expect(result.errors).toEqual([
      'media-src/dmns/loop.mp4: missing loop.webm (clips need both mp4 and webm)',
    ]);
  });
});

describe('manifests (FR-328, FR-329, FR-334)', () => {
  const entries: ImageManifestInput[] = [
    { key: 'sublist/cover', width: 1440, height: 810, widths: [960, 480, 1440], source: 'a.webp' },
    { key: 'Zed/cover', width: 960, height: 600, widths: [480, 960], source: 'cover.png' },
    { key: 'dmns/cover', width: 1440, height: 810, widths: [480, 960, 1440], source: 'cover.webp' },
    { key: 'dmns-x/cover', width: 480, height: 300, widths: [480], source: 'cover.jpg' },
  ];

  it('sorts keys by code unit and widths ascending', () => {
    const manifest = buildManifest(entries);
    expect(Object.keys(manifest)).toEqual([
      'Zed/cover',
      'dmns-x/cover',
      'dmns/cover',
      'sublist/cover',
    ]);
    expect(manifest['sublist/cover']?.widths).toEqual([480, 960, 1440]);
    expect(manifest['dmns/cover']).toEqual({
      width: 1440,
      height: 810,
      widths: [480, 960, 1440],
      source: 'cover.webp',
    });
  });

  it('serializes identically for shuffled input, with a trailing newline', () => {
    const a = serializeManifest(buildManifest(entries));
    const b = serializeManifest(buildManifest([...entries].reverse()));
    expect(a).toBe(b);
    expect(a.endsWith('}\n')).toBe(true);
    expect(a).toContain('\n  "dmns/cover": {\n    "width": 1440,');
  });

  it('builds the video manifest', () => {
    expect(serializeManifest(buildVideoManifest(['z/clip', 'merchants/clip']))).toBe(
      `${JSON.stringify(
        { 'merchants/clip': { formats: ['mp4', 'webm'] }, 'z/clip': { formats: ['mp4', 'webm'] } },
        null,
        2,
      )}\n`,
    );
  });
});
