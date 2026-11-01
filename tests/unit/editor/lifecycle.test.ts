// Create and delete wiring (spec 004 edit-layer FR-393, FR-394, T391).
import { describe, expect, it, vi } from 'vitest';
import { Lifecycle } from '../../../src/admin/edit/lifecycle.ts';
import type { Publisher } from '../../../src/admin/edit/publish-flow.ts';
import { ToolbarController } from '../../../src/admin/edit/toolbar-wiring.ts';
import { Validation } from '../../../src/admin/edit/validation.ts';
import type { PublishResult } from '../../../src/core/github/types.ts';
import { projectFile } from '../../../src/content/paths.ts';
import { baseBundle } from '../../fixtures/content/bundle.ts';
import { baseProject } from '../../fixtures/content/projects.ts';
import { setup } from './dom.ts';
import { demoDraft } from './fixtures.ts';

type Run = Publisher['run'];

function mount(raw = baseBundle()): ReturnType<typeof setup> & {
  lifecycle: Lifecycle;
  toolbar: ToolbarController;
  run: ReturnType<typeof vi.fn<Run>>;
} {
  const ctx = setup(demoDraft());
  ctx.layer.replaceDraft(ctx.layer.draft ?? demoDraft(), raw);
  const toolbar = new ToolbarController(ctx.layer, new Validation(ctx.layer));
  const ok: PublishResult = { kind: 'ok', commitSha: 'c', commitUrl: 'u', rebased: false };
  const run = vi.fn<Run>(() => Promise.resolve(ok));
  const lifecycle = new Lifecycle(ctx.layer, toolbar, { run });
  return { ...ctx, lifecycle, toolbar, run };
}

const confirmDialog = (): HTMLDialogElement => {
  const d = document.querySelector('admin-confirm dialog');
  if (!(d instanceof HTMLDialogElement)) throw new Error('no confirm');
  return d;
};
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('New project form (FR-393)', () => {
  it('refuses a duplicate or non-kebab slug on input', () => {
    const { lifecycle } = mount();
    lifecycle.openForm();
    const slug = document.querySelector<HTMLInputElement>('#adn-slug');
    if (!slug) throw new Error('no slug');
    expect(document.activeElement).toBe(slug);
    const error = document.getElementById('adn-slug-error');
    slug.value = 'Not Kebab';
    slug.dispatchEvent(new Event('input', { bubbles: true }));
    expect(slug.getAttribute('aria-invalid')).toBe('true');
    expect(error?.textContent).toMatch(/lowercase/);
    slug.value = 'dmns'; // a bundled project
    slug.dispatchEvent(new Event('input', { bubbles: true }));
    expect(error?.textContent).toBe('A project named dmns already exists.');
    slug.value = 'brand-new';
    slug.dispatchEvent(new Event('input', { bubbles: true }));
    expect(slug.hasAttribute('aria-invalid')).toBe(false);
    expect(slug.getAttribute('aria-describedby')).toContain('adn-slug-error');
  });
});

describe('Delete (FR-394)', () => {
  it('names the referrer when another project uses its media', async () => {
    const image = { kind: 'image', src: 'demo/cover', alt: 'Demo' };
    const { lifecycle, run, toolbar } = mount(
      baseBundle({ p3: baseProject('p3', { media: image }) }),
    );
    await lifecycle.delete('demo');
    expect(run).not.toHaveBeenCalled();
    expect(document.querySelector('admin-confirm dialog[open]')).toBeNull();
    expect(toolbar.state().notice).toContain(projectFile('p3'));
  });

  it('confirms with the typed slug, then publishes one delete commit', async () => {
    const { lifecycle, run } = mount();
    const done = lifecycle.delete('demo');
    await tick();
    const d = confirmDialog();
    expect(d.open).toBe(true);
    const input = d.querySelector('input');
    if (!input) throw new Error('no input');
    input.value = 'demo';
    input.dispatchEvent(new Event('input'));
    [...d.querySelectorAll('button')].find((b) => b.textContent === 'Delete and publish')?.click();
    await done;
    expect(run).toHaveBeenCalledTimes(1);
    const [changes, action, slug] = run.mock.calls[0] ?? [];
    expect(action).toBe('delete');
    expect(slug).toBe('demo');
    expect(changes?.map((c) => c.kind)).toEqual(['delete', 'put', 'delete-dir']);
  });

  it('Cancel publishes nothing', async () => {
    const { lifecycle, run } = mount();
    const done = lifecycle.delete('demo');
    await tick();
    confirmDialog().close('cancel');
    await done;
    expect(run).not.toHaveBeenCalled();
  });
});
