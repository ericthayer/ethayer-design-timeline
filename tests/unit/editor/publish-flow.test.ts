// Publish flow (spec 004 edit-layer FR-395, FR-397, FR-398, T392).
import { describe, expect, it, vi } from 'vitest';
import { PublishFlow, type Publisher, baseDraft } from '../../../src/admin/edit/publish-flow.ts';
import { ToolbarController } from '../../../src/admin/edit/toolbar-wiring.ts';
import { Validation } from '../../../src/admin/edit/validation.ts';
import type { PublishResult } from '../../../src/core/github/types.ts';
import { baseBundle } from '../../fixtures/content/bundle.ts';
import { setup } from './dom.ts';
import { SHA, demoDraft } from './fixtures.ts';

type Run = Publisher['run'];
const NEW_SHA = 'c'.repeat(40);

function mount(result: PublishResult): ReturnType<typeof setup> & {
  flow: PublishFlow;
  run: ReturnType<typeof vi.fn<Run>>;
  toolbar: ToolbarController;
} {
  const ctx = setup(demoDraft());
  ctx.layer.replaceDraft(ctx.layer.draft ?? demoDraft(), baseBundle());
  const validation = new Validation(ctx.layer);
  const toolbar = new ToolbarController(ctx.layer, validation);
  const run = vi.fn<Run>(() => Promise.resolve(result));
  const flow = new PublishFlow(ctx.layer, validation, toolbar, { run });
  ctx.layer.dispatch({ kind: 'text', pointer: '/title', value: 'Demo, renamed' });
  return { ...ctx, flow, run, toolbar };
}

describe('publish (FR-397)', () => {
  it('after ok, the base is the new commit and nothing is left to publish', async () => {
    const { flow, layer, run } = mount({
      kind: 'ok',
      commitSha: NEW_SHA,
      commitUrl: 'https://github.com/o/r/commit/c',
      rebased: false,
    });
    expect(layer.changes).toBe(1);
    await flow.publish();
    expect(run).toHaveBeenCalledTimes(1);
    const [changes, action, slug, base] = run.mock.calls[0] ?? [];
    expect([action, slug, base]).toEqual(['update', 'demo', SHA]);
    expect(changes?.map((c) => c.kind)).toEqual(['put']);
    expect(layer.draft?.base.sha).toBe(NEW_SHA);
    expect(layer.draft?.working.title).toBe('Demo, renamed');
    expect(layer.changes).toBe(0);
    expect(await layer.store.slugs()).toEqual([]);
  });

  it.each<PublishResult>([
    { kind: 'network' },
    { kind: 'rate-limited', resetAt: 0 },
    { kind: 'forbidden', reason: 'branch-protected' },
    { kind: 'unauthorized' },
  ])('$kind keeps the draft', async (result) => {
    const { flow, layer } = mount(result);
    await flow.publish();
    expect(layer.draft?.base.sha).toBe(SHA);
    expect(layer.changes).toBe(1);
  });

  it('ignores Publish while one is in flight', async () => {
    const { flow, layer, run } = mount({ kind: 'network' });
    layer.busy = true;
    expect(await flow.publish()).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it('blocks on errors and opens Issues', async () => {
    const { flow, layer, run, toolbar } = mount({ kind: 'network' });
    layer.dispatch({
      kind: 'settings',
      patch: {
        media: {
          kind: 'iframe',
          src: 'https://example.com/',
          title: 'Site',
          viewport: 'desktop',
          poster: { kind: 'image', src: 'demo/cover', alt: '' },
        },
      },
    });
    expect(await flow.publish()).toBeNull();
    expect(run).not.toHaveBeenCalled();
    expect(toolbar.toolbar.issuesOpen).toBe(true);
  });
});

describe('Discard (FR-396)', () => {
  it('returns the draft to the repository version', () => {
    const draft = demoDraft();
    const edited = { ...draft, working: { ...draft.working, title: 'Changed' } };
    expect(baseDraft(edited)?.working.title).toBe('Demo');
  });
});
