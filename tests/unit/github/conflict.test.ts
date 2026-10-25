import { describe, expect, it } from 'vitest';
import { conflictingPaths } from '../../../src/core/github/conflict.ts';
import type { FileChange, WireCompare } from '../../../src/core/github/types.ts';
import compare from './fixtures/compare.json';

const put = (path: string): FileChange => ({ kind: 'put', path, content: '{}' });

describe('conflictingPaths (FR-369)', () => {
  it('finds nothing when the paths are disjoint', () => {
    expect(conflictingPaths(compare, [put('src/content/data/projects/dmns.json')])).toEqual({
      kind: 'none',
    });
  });

  it('lists a changed path', () => {
    expect(conflictingPaths(compare, [put('src/content/data/projects/other.json')])).toEqual({
      kind: 'conflict',
      reason: 'paths-changed',
      paths: ['src/content/data/projects/other.json'],
    });
  });

  it('catches a rename through previous_filename', () => {
    const changes: FileChange[] = [{ kind: 'delete', path: 'media-src/old-name/cover.webp' }];
    expect(conflictingPaths(compare, changes)).toMatchObject({
      reason: 'paths-changed',
      paths: ['media-src/old-name/cover.webp'],
    });
  });

  it('catches a file under a delete-dir prefix', () => {
    const changes: FileChange[] = [{ kind: 'delete-dir', path: 'media-src/new-name/' }];
    expect(conflictingPaths(compare, changes)).toMatchObject({
      reason: 'paths-changed',
      paths: ['media-src/new-name/cover.webp'],
    });
    const sibling: FileChange[] = [{ kind: 'delete-dir', path: 'media-src/new/' }];
    expect(conflictingPaths(compare, sibling)).toEqual({ kind: 'none' });
  });

  it.each(['diverged', 'behind', 'identical'])('treats status %s as history-diverged', (status) => {
    expect(conflictingPaths({ ...compare, status }, [put('x')])).toEqual({
      kind: 'conflict',
      reason: 'history-diverged',
      paths: [],
    });
  });

  it('treats a full 300-file page as truncated', () => {
    const files = Array.from({ length: 300 }, (_, i) => ({ filename: `f${i}` }));
    const full: WireCompare = { status: 'ahead', files };
    expect(conflictingPaths(full, [put('x')])).toEqual({
      kind: 'conflict',
      reason: 'compare-truncated',
      paths: [],
    });
    expect(conflictingPaths({ status: 'ahead', files: files.slice(1) }, [put('x')])).toEqual({
      kind: 'none',
    });
  });
});
