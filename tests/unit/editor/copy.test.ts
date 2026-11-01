// Publish and deploy copy, and the preview guard (spec 004 edit-layer FR-382, FR-397, FR-398, T383).
import { describe, expect, it } from 'vitest';
import { deployCopy, publishCopy, resetCopy } from '../../../src/core/editor/copy.ts';
import { asProject } from '../../../src/core/editor/preview.ts';
import type { DeployState, PublishResult } from '../../../src/core/github/types.ts';
import { DEPLOYS_URL } from '../../../src/core/github/deploy-state.ts';
import type { AnyCardMedia, Size } from '../../../src/content/types.ts';
import { projectFile } from '../../../src/content/paths.ts';
import { validateProject } from '../../../src/content/validate/index.ts';
import { CTX } from '../../fixtures/content/projects.ts';
import { demoProject } from './fixtures.ts';

const SHA = 'c'.repeat(40);
const NOW = Date.UTC(2026, 10, 1, 14, 20);
const ENV = { now: NOW, locale: 'en-GB', timeZone: 'UTC' };

/** One sample per result kind: a missing kind fails typecheck. */
const SAMPLES: { [K in PublishResult['kind']]: Extract<PublishResult, { kind: K }> } = {
  ok: { kind: 'ok', commitSha: SHA, commitUrl: 'https://github.com/x/y/commit/c', rebased: false },
  unchanged: { kind: 'unchanged', headSha: SHA },
  conflict: {
    kind: 'conflict',
    reason: 'paths-changed',
    paths: ['a.json', 'b.json'],
    headSha: SHA,
  },
  'rate-limited': { kind: 'rate-limited', resetAt: NOW + 12 * 60_000 },
  forbidden: { kind: 'forbidden', reason: 'branch-protected' },
  unauthorized: { kind: 'unauthorized' },
  'too-large': { kind: 'too-large', path: 'media-src/demo/big.png', limitBytes: 10 * 1024 * 1024 },
  invalid: { kind: 'invalid', reason: 'bad-path', path: 'x/y' },
  'not-found': { kind: 'not-found' },
  'validation-rejected': { kind: 'validation-rejected', message: 'Update is not a fast forward' },
  network: { kind: 'network' },
  unknown: { kind: 'unknown', status: 502 },
};

describe('publishCopy (FR-397)', () => {
  it('has copy for every result kind, and only ok and unchanged are not urgent', () => {
    for (const result of Object.values(SAMPLES)) {
      const copy = publishCopy(result, ENV);
      expect(copy.text.length).toBeGreaterThan(5);
      expect(copy.urgent).toBe(result.kind !== 'ok' && result.kind !== 'unchanged');
    }
  });

  it('matches the spec wording', () => {
    const text = (r: PublishResult): string => publishCopy(r, ENV).text;
    expect(text(SAMPLES.ok)).toBe('Published.');
    expect(text({ ...SAMPLES.ok, rebased: true })).toBe('Published on top of newer commits.');
    expect(text(SAMPLES.unchanged)).toBe('Nothing to publish: the repository already matches.');
    expect(text(SAMPLES.conflict)).toBe(
      'These files changed on GitHub since you started: a.json, b.json.',
    );
    expect(text({ ...SAMPLES.conflict, reason: 'race' })).toBe(
      'Someone published at the same moment.',
    );
    expect(text(SAMPLES['rate-limited'])).toBe(
      "GitHub's rate limit is reached. Try again after 14:32 (in 12 min).",
    );
    expect(text({ kind: 'forbidden', reason: 'missing-permission' })).toBe(
      "Your token can't write here. Set Contents to Read and write.",
    );
    expect(text(SAMPLES['too-large'])).toBe(
      'media-src/demo/big.png is larger than the 10 MB limit.',
    );
    expect(text(SAMPLES.invalid)).toBe(
      'The editor built a change GitHub refused (bad path, x/y). Please report it.',
    );
    expect(text(SAMPLES.network)).toBe("Couldn't reach GitHub. Your draft is safe.");
    expect(text(SAMPLES.unknown)).toBe('Unexpected response from GitHub (502).');
  });

  it('formats the reset time with Intl and rounds minutes up', () => {
    expect(resetCopy(NOW + 30_000, ENV)).toBe('14:20 (in 1 min)');
  });
});

describe('deployCopy (FR-398)', () => {
  it('covers every state, with links for failed and unknown', () => {
    const states: DeployState[] = [
      { kind: 'queued', logUrl: null },
      { kind: 'building', logUrl: null },
      { kind: 'live', logUrl: 'https://log' },
    ];
    expect(states.map((s) => deployCopy(s).label)).toEqual(['Queued', 'Building', 'Live']);
    expect(deployCopy({ kind: 'failed', logUrl: 'https://log' })).toMatchObject({
      label: 'Build failed',
      link: { text: 'View log', href: 'https://log' },
    });
    expect(deployCopy({ kind: 'failed', logUrl: null }).link?.href).toBe(DEPLOYS_URL);
    expect(deployCopy({ kind: 'failed', logUrl: null }).detail).toContain(
      'The live site is unchanged.',
    );
    expect(deployCopy({ kind: 'unknown', reason: 'timeout' })).toMatchObject({
      label: 'Status unknown',
      link: { text: 'Check Netlify', href: DEPLOYS_URL },
    });
  });
});

describe('asProject (FR-382)', () => {
  const poster = { kind: 'image', src: 'demo/cover', alt: 'Demo' } as const;
  const MEDIA: readonly AnyCardMedia[] = [
    { kind: 'artwork' },
    { kind: 'placeholder', variant: 'site' },
    poster,
    { kind: 'video', src: 'demo/clip', poster, label: 'Demo loop', durationSec: 6 },
    { kind: 'iframe', src: 'https://demo.netlify.app/', title: 'Demo', viewport: 'mobile', poster },
    {
      kind: 'iframe',
      src: 'https://demo.netlify.app/',
      title: 'Demo',
      viewport: 'desktop',
      poster,
    },
  ];
  const SIZES: readonly Size[] = ['sm', 'wide', 'tall', 'feature'];

  it('agrees with the validator size-media rule for every size × media kind', () => {
    for (const size of SIZES) {
      for (const media of MEDIA) {
        const working = demoProject({ size, media });
        const result = validateProject(structuredClone(working), projectFile('demo'), CTX);
        const sizeMedia = !result.ok && result.errors.some((i) => i.rule === 'size-media');
        expect([size, media.kind, asProject(working) === null]).toEqual([
          size,
          media.kind,
          sizeMedia,
        ]);
      }
    }
  });
});
