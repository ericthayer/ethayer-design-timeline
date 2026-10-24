import { describe, expect, it } from 'vitest';
import {
  checkChanges,
  checkEntryCount,
  checkReadPath,
  isMediaDir,
  PUBLISH_LIMITS,
} from '../../../src/core/github/paths.ts';
import type { FileChange, PublishRequest } from '../../../src/core/github/types.ts';

const SHA = 'a'.repeat(40);
const MB = 1024 * 1024;
const req = (...changes: FileChange[]): PublishRequest => ({
  changes,
  message: 'content: update dmns via admin',
  expectedHeadSha: SHA,
});
const put = (path: string, content = '{}\n'): FileChange => ({ kind: 'put', path, content });
const bin = (path: string, size = 4): FileChange => ({
  kind: 'put-binary',
  path,
  bytes: new Uint8Array(size),
});

describe('checkChanges allowlist (FR-363)', () => {
  it('accepts the allowed shapes', () => {
    expect(
      checkChanges(
        req(
          put('src/content/data/projects/dmns.json'),
          put('src/content/data/order.json'),
          bin('media-src/dmns/cover.webp'),
          bin('media-src/dmns/clip.mp4'),
          { kind: 'delete', path: 'src/content/data/projects/old.json' },
          { kind: 'delete', path: 'media-src/dmns/shot-1.jpg' },
          { kind: 'delete-dir', path: 'media-src/old/' },
        ),
      ),
    ).toBeNull();
  });

  it.each([
    ['../src/content/data/x.json', 'bad-path'],
    ['src/content/data/../../../package.json', 'bad-path'],
    ['src/content/data/./x.json', 'bad-path'],
    ['.github/workflows/ci.yml', 'bad-path'],
    ['/src/content/data/x.json', 'bad-path'],
    ['src\\content\\data\\x.json', 'bad-path'],
    ['src/content/data/.env', 'bad-path'],
    ['src/content/data//x.json', 'bad-path'],
    ['src/content/data/%2e%2e/x.json', 'bad-path'],
    ['', 'bad-path'],
    [`src/content/data/${'a'.repeat(200)}.json`, 'bad-path'],
    ['src/main.ts', 'not-allowed'],
    ['src/content/data/x.ts', 'not-allowed'],
    ['src/content/data.json', 'not-allowed'],
    ['media-src/dmns/cover.webp', 'not-allowed'],
  ])('put %s → %s', (path, reason) => {
    expect(checkChanges(req(put(path)))).toEqual({ kind: 'invalid', reason, path });
  });

  it.each([
    ['media-src/dmns/cover.gif', 'not-allowed'],
    ['media-src/dmns/cover.JPG', 'not-allowed'],
    ['media-src/dmns/cover', 'not-allowed'],
    ['media-src/cover.webp', 'not-allowed'],
    ['media-src/a/b/cover.webp', 'not-allowed'],
    ['public/cover.webp', 'not-allowed'],
    ['media-src/dmns/.cover.webp', 'bad-path'],
    ['media-src/dmns/co ver.webp', 'bad-path'],
  ])('put-binary %s → %s', (path, reason) => {
    expect(checkChanges(req(bin(path)))).toEqual({ kind: 'invalid', reason, path });
  });

  it('limits delete-dir to media-src/<slug>/', () => {
    expect(isMediaDir('media-src/dmns/')).toBe(true);
    for (const path of ['media-src/dmns', 'media-src/', 'src/content/data/', 'media-src/a/b/']) {
      expect(checkChanges(req({ kind: 'delete-dir', path }))).toMatchObject({ kind: 'invalid' });
    }
    expect(checkChanges(req({ kind: 'delete', path: '.github/x.yml' }))).toMatchObject({
      reason: 'bad-path',
    });
  });

  it('rejects a duplicate path', () => {
    const path = 'src/content/data/order.json';
    expect(checkChanges(req(put(path), { kind: 'delete', path }))).toEqual({
      kind: 'invalid',
      reason: 'duplicate-path',
      path,
    });
  });

  it('applies the JSON allowlist to reads', () => {
    expect(checkReadPath('src/content/data/projects/dmns.json')).toBeNull();
    expect(checkReadPath('package.json')).toMatchObject({ reason: 'not-allowed' });
    expect(checkReadPath('../x.json')).toMatchObject({ reason: 'bad-path' });
  });
});

describe('checkChanges limits (FR-364)', () => {
  it('rejects an empty or overlong change list, a blank message, and a bad sha', () => {
    expect(checkChanges(req())).toMatchObject({ reason: 'no-changes' });
    const many = Array.from({ length: 51 }, (_, i) => put(`src/content/data/p${i}.json`));
    expect(checkChanges(req(...many))).toEqual({
      kind: 'invalid',
      reason: 'too-many-changes',
      path: null,
    });
    expect(checkChanges(req(...many.slice(0, 50)))).toBeNull();
    const one = put('src/content/data/order.json');
    expect(checkChanges({ ...req(one), message: '  ' })).toMatchObject({ reason: 'empty-message' });
    expect(checkChanges({ ...req(one), expectedHeadSha: 'main' })).toMatchObject({
      reason: 'bad-sha',
    });
  });

  it('rejects an 11 MB binary and accepts 10 MB', () => {
    const path = 'media-src/dmns/cover.png';
    expect(checkChanges(req(bin(path, 11 * MB)))).toEqual({
      kind: 'too-large',
      path,
      limitBytes: 10 * MB,
    });
    expect(checkChanges(req(bin(path, 10 * MB)))).toBeNull();
  });

  it('counts text in UTF-8 bytes', () => {
    const path = 'src/content/data/order.json';
    const text = 'é'.repeat(MB / 2 + 1); // 2 bytes each
    expect(checkChanges(req(put(path, text)))).toEqual({
      kind: 'too-large',
      path,
      limitBytes: PUBLISH_LIMITS.maxTextBytes,
    });
  });

  it('caps the publish at 40 MB raw', () => {
    const files = Array.from({ length: 5 }, (_, i) => bin(`media-src/dmns/s${i}.jpg`, 9 * MB));
    expect(checkChanges(req(...files))).toEqual({
      kind: 'too-large',
      path: null,
      limitBytes: 40 * MB,
    });
  });

  it('caps tree entries at 300', () => {
    expect(checkEntryCount(300)).toBeNull();
    expect(checkEntryCount(301)).toMatchObject({ reason: 'too-many-entries' });
  });
});
