// Editor media rules (spec 004 edit-layer FR-392, FR-394, T381).
import { describe, expect, it } from 'vitest';
import {
  deletePaths,
  kebabName,
  mediaDeletes,
  referencedKeys,
  stagedTarget,
  uploadName,
  uploadTarget,
} from '../../../src/core/editor/media.ts';

const none = new Set<string>();

describe('upload naming (FR-392)', () => {
  it('kebab-cases the basename and lowercases the extension', () => {
    expect(uploadTarget('My Shot.PNG', 'dmns', none)).toEqual({
      path: 'media-src/dmns/my-shot.png',
      key: 'dmns/my-shot',
    });
    expect(kebabName('  Café__Menu (final).jpeg')).toBe('cafe-menu-final');
    expect(kebabName('.png')).toBe('image');
    expect(kebabName('!!!.webp')).toBe('image');
  });

  it('adds -n against known keys and the reserved card names', () => {
    expect(uploadName('my-shot.png', 'dmns', new Set(['dmns/my-shot']))).toBe('my-shot-2');
    expect(uploadName('my-shot.png', 'dmns', new Set(['dmns/my-shot', 'dmns/my-shot-2']))).toBe(
      'my-shot-3',
    );
    expect(uploadName('Cover.jpg', 'dmns', none)).toBe('cover-2');
    expect(uploadName('clip.mp4', 'dmns', none)).toBe('clip-2');
    expect(uploadName('my-shot.png', 'other', new Set(['dmns/my-shot']))).toBe('my-shot');
  });

  it('gives a card upload its reserved name, even when taken', () => {
    expect(uploadTarget('Hero Final.webp', 'dmns', new Set(['dmns/cover']), 'cover')).toEqual({
      path: 'media-src/dmns/cover.webp',
      key: 'dmns/cover',
    });
  });

  it('refuses an extension or slug the pipeline would refuse', () => {
    expect(stagedTarget('dmns', 'shot', 'gif')).toBeNull();
    expect(stagedTarget('Bad Slug', 'shot', 'png')).toBeNull();
  });
});

describe('referencedKeys', () => {
  it('walks cards, posters, gallery tiles, and the résumé intro', () => {
    const project = {
      media: { kind: 'iframe', src: 'https://x.dev', poster: { kind: 'image', src: 'a/cover' } },
      gallery: [
        { media: { kind: 'video', src: 'a/clip', poster: { kind: 'image', src: 'a/poster' } } },
        { media: { kind: 'vimeo', id: '1' } },
        { media: { kind: 'placeholder', variant: 'site' } },
      ],
    };
    const resume = { intro: { src: 'resume/intro', captions: '/captions/x.vtt' } };
    expect([...referencedKeys([project, resume])].sort()).toEqual([
      'a/clip',
      'a/cover',
      'a/poster',
      'resume/intro',
    ]);
  });
});

describe('delete paths (FR-392, FR-394)', () => {
  it('uses the manifest source when known, and every candidate otherwise', () => {
    expect(deletePaths('dmns/shot', 'image', none, 'shot.webp')).toEqual([
      'media-src/dmns/shot.webp',
    ]);
    expect(deletePaths('dmns/shot', 'image', none)).toEqual([
      'media-src/dmns/shot.jpg',
      'media-src/dmns/shot.jpeg',
      'media-src/dmns/shot.png',
      'media-src/dmns/shot.webp',
      'media-src/dmns/shot.avif',
    ]);
    expect(deletePaths('dmns/clip', 'video', none)).toEqual([
      'media-src/dmns/clip.mp4',
      'media-src/dmns/clip.webm',
    ]);
  });

  it('leaves out the put path on a same-key replace with a new extension', () => {
    const puts = new Set(['media-src/dmns/cover.png']);
    const paths = deletePaths('dmns/cover', 'image', puts);
    expect(paths).not.toContain('media-src/dmns/cover.png');
    expect(paths).toContain('media-src/dmns/cover.webp');
  });

  it('never deletes a key still referenced elsewhere, or one not in a manifest', () => {
    const image = { width: 1, height: 1, widths: [480], source: 'shot.png' };
    const paths = mediaDeletes({
      before: new Set(['dmns/shot', 'dmns/shared', 'dmns/clip', 'dmns/unknown']),
      after: new Set(['dmns/shared']),
      images: { 'dmns/shot': image, 'dmns/shared': { ...image, source: 'shared.png' } },
      videoKeys: new Set(['dmns/clip']),
      puts: none,
    });
    expect(paths).toEqual([
      'media-src/dmns/clip.mp4',
      'media-src/dmns/clip.webm',
      'media-src/dmns/shot.png',
    ]);
  });
});
