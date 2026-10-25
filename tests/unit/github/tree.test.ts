import { describe, expect, it } from 'vitest';
import {
  expandDeletes,
  fromBase64,
  needsTree,
  toBase64,
  treeEntries,
} from '../../../src/core/github/tree.ts';
import type { FileChange } from '../../../src/core/github/types.ts';
import recursive from './fixtures/tree-recursive.json';

const SHA = 'b'.repeat(40);

describe('treeEntries (FR-365, FR-366)', () => {
  it('emits blob shas for uploads and sha: null for deletions', () => {
    expect(
      treeEntries(
        [
          { path: 'src/content/data/projects/dmns.json', sha: SHA },
          { path: 'media-src/dmns/cover.webp', sha: SHA },
        ],
        ['src/content/data/projects/old.json'],
      ),
    ).toEqual([
      { path: 'media-src/dmns/cover.webp', mode: '100644', type: 'blob', sha: SHA },
      { path: 'src/content/data/projects/dmns.json', mode: '100644', type: 'blob', sha: SHA },
      { path: 'src/content/data/projects/old.json', mode: '100644', type: 'blob', sha: null },
    ]);
  });

  it('serializes deletions with an explicit null sha', () => {
    expect(JSON.stringify(treeEntries([], ['a.json']))).toContain('"sha":null');
  });
});

describe('expandDeletes (FR-366)', () => {
  const base = recursive.tree;

  it('expands delete-dir by prefix, without touching a sibling folder that shares it', () => {
    const changes: FileChange[] = [{ kind: 'delete-dir', path: 'media-src/dmns/' }];
    expect(expandDeletes(changes, base)).toEqual([
      'media-src/dmns/cover.webp',
      'media-src/dmns/shot-1.jpg',
    ]);
  });

  it('drops deletions of missing files', () => {
    const changes: FileChange[] = [
      { kind: 'delete', path: 'src/content/data/projects/dmns.json' },
      { kind: 'delete', path: 'src/content/data/projects/gone.json' },
      { kind: 'delete-dir', path: 'media-src/none/' },
    ];
    expect(expandDeletes(changes, base)).toEqual(['src/content/data/projects/dmns.json']);
  });

  it('keeps a file the same request uploads into a deleted folder', () => {
    const changes: FileChange[] = [
      { kind: 'delete-dir', path: 'media-src/dmns/' },
      { kind: 'put-binary', path: 'media-src/dmns/cover.webp', bytes: new Uint8Array(1) },
    ];
    expect(expandDeletes(changes, base)).toEqual(['media-src/dmns/shot-1.jpg']);
  });

  it('knows when a tree read is needed', () => {
    expect(needsTree([{ kind: 'put', path: 'a', content: '' }])).toBe(false);
    expect(needsTree([{ kind: 'delete', path: 'a' }])).toBe(true);
  });
});

describe('toBase64', () => {
  const random = (n: number): Uint8Array => {
    const bytes = new Uint8Array(n);
    for (let i = 0; i < n; i += 65536) crypto.getRandomValues(bytes.subarray(i, i + 65536));
    return bytes;
  };

  it.each([0, 1, 2, 3, 4, 100, 24_577])('round-trips %i random bytes', (n) => {
    const bytes = random(n);
    const encoded = toBase64(bytes);
    expect(encoded).toBe(Buffer.from(bytes).toString('base64'));
    expect(fromBase64(encoded)).toEqual(bytes);
  });

  it('round-trips a 10 MB buffer', () => {
    const bytes = random(10 * 1024 * 1024);
    const encoded = toBase64(bytes);
    expect(encoded).toBe(Buffer.from(bytes).toString('base64'));
    expect(Buffer.from(fromBase64(encoded)).equals(Buffer.from(bytes))).toBe(true);
  });

  it('uses the native encoder when present', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    Object.defineProperty(bytes, 'toBase64', { value: () => 'native' });
    expect(toBase64(bytes)).toBe('native');
  });

  it('decodes GitHub-wrapped content', () => {
    expect(new TextDecoder().decode(fromBase64('aGVs\nbG8=\n'))).toBe('hello');
  });
});
