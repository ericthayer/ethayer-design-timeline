import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ContentChange } from '../../../src/content/changes.ts';
import {
  isCombinedStatus,
  isCommit,
  isCompare,
  isContents,
  isRef,
  isSha,
  isTree,
  messageOf,
  type FileChange,
} from '../../../src/core/github/types.ts';
import blob from './fixtures/blob.json';
import combinedStatus from './fixtures/combined-status.json';
import commit from './fixtures/commit.json';
import compare from './fixtures/compare.json';
import contents from './fixtures/contents.json';
import notFastForward from './fixtures/error-not-fast-forward.json';
import ref from './fixtures/ref.json';
import treeRecursive from './fixtures/tree-recursive.json';
import tree from './fixtures/tree.json';

/** A deep copy with one field replaced, to prove each guard rejects a mutated shape. */
const mutate = (value: object, key: string, next: unknown): unknown => ({
  ...structuredClone(value),
  [key]: next,
});

describe('wire guards (FR-373)', () => {
  it.each([
    ['ref', isRef, ref, 'object'],
    ['commit', isCommit, commit, 'tree'],
    ['blob', isSha, blob, 'sha'],
    ['tree', isTree, tree, 'truncated'],
    ['recursive tree', isTree, treeRecursive, 'tree'],
    ['compare', isCompare, compare, 'files'],
    ['combined status', isCombinedStatus, combinedStatus, 'statuses'],
    ['contents', isContents, contents, 'content'],
  ] as const)('%s: accepts the fixture and rejects a mutated one', (_name, guard, fixture, key) => {
    expect(guard(fixture)).toBe(true);
    expect(guard(mutate(fixture, key, 42))).toBe(false);
    expect(guard(null)).toBe(false);
    expect(guard([])).toBe(false);
  });

  it('rejects a nested mutation', () => {
    const bad = structuredClone(compare);
    Object.assign(bad.files[1] ?? {}, { previous_filename: 7 });
    expect(isCompare(bad)).toBe(false);
    const status = structuredClone(combinedStatus);
    Object.assign(status.statuses[0] ?? {}, { target_url: 1 });
    expect(isCombinedStatus(status)).toBe(false);
  });

  it('reads an error message', () => {
    expect(messageOf(notFastForward)).toBe('Update is not a fast forward');
    expect(messageOf('nope')).toBeNull();
    expect(messageOf({ message: 1 })).toBeNull();
  });
});

describe('FileChange (FR-361)', () => {
  it('accepts content-json change plans structurally', () => {
    expectTypeOf<readonly ContentChange[]>().toExtend<readonly FileChange[]>();
  });
});
