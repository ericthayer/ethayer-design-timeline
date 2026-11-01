// Publishing (spec 004 edit-layer FR-394, FR-395, FR-397, FR-398): the gate, one commit per run,
// result routing, and deploy watching. Repeat runs while one is in flight are ignored, and every
// failure keeps the draft.
import { confirmDialog } from '../../components/admin-confirm/admin-confirm.ts';
import { CONTENT_FILES, projectFile } from '../../content/paths.ts';
import { parseJson } from '../../content/validate/issue.ts';
import { validateProject } from '../../content/validate/project.ts';
import { workPath } from '../../core/router.ts';
import {
  type PlannedChange,
  applyContent,
  contentOnly,
  rebase,
  validationContext,
} from '../../core/editor/changes.ts';
import { conflictConfirm, discardConfirm, warningsConfirm } from '../../core/editor/confirm.ts';
import { deployCopy, publishCopy } from '../../core/editor/copy.ts';
import type { Draft } from '../../core/editor/draft.ts';
import type { JobStatus } from '../../core/editor/toolbar.ts';
import {
  commitMessage,
  publish,
  readFile,
  readHead,
  watchDeploy,
} from '../../core/github/index.ts';
import type { FileChange, PublishResult } from '../../core/github/types.ts';
import { EDITOR_CONTEXT } from './bundled.ts';
import type { DraftStore } from './draft-store.ts';
import type { EditLayer } from './edit-layer.ts';
import { draftFrom, readOrder, takeSnapshot } from './snapshot.ts';
import type { ToolbarController } from './toolbar-wiring.ts';
import type { Validation } from './validation.ts';

export type Action = 'create' | 'update' | 'delete';

/** github-publish changes: a staged file's bytes come from the blob store (FR-385). */
export async function toFileChanges(
  planned: readonly PlannedChange[],
  store: Pick<DraftStore, 'getBlob'>,
): Promise<{ kind: 'ok'; changes: FileChange[] } | { kind: 'missing'; path: string }> {
  const changes: FileChange[] = [];
  for (const change of planned) {
    if (change.kind !== 'put-media') {
      changes.push(change);
      continue;
    }
    const blob = await store.getBlob(change.path);
    if (blob === null) return { kind: 'missing', path: change.path };
    changes.push({
      kind: 'put-binary',
      path: change.path,
      bytes: new Uint8Array(await blob.arrayBuffer()),
    });
  }
  return { kind: 'ok', changes };
}

/** The toolbar's job for a result: deploy watching starts from `deploying` (FR-398). */
export function jobOf(result: PublishResult): JobStatus {
  switch (result.kind) {
    case 'ok':
      return {
        kind: 'deploying',
        commitUrl: result.commitUrl,
        deploy: { kind: 'queued', logUrl: null },
      };
    case 'unchanged':
      return { kind: 'none' };
    case 'conflict':
      return { kind: 'conflict', reason: result.reason, paths: result.paths };
    default:
      return { kind: 'failed', result };
  }
}

export class Publisher {
  readonly #layer: EditLayer;
  readonly #toolbar: ToolbarController;

  constructor(layer: EditLayer, toolbar: ToolbarController) {
    this.#layer = layer;
    this.#toolbar = toolbar;
  }

  /** Publishes `planned` on `baseSha`. Null when a run is already in flight or a blob is gone. */
  async run(
    planned: readonly PlannedChange[],
    action: Action,
    slug: string,
    baseSha: string,
  ): Promise<PublishResult | null> {
    const layer = this.#layer;
    if (layer.busy) return null;
    layer.busy = true;
    this.#setJob({ kind: 'publishing', files: planned.length });
    try {
      const files = await toFileChanges(planned, layer.store);
      if (files.kind === 'missing') {
        this.#setJob({ kind: 'none' }, `${files.path} is no longer in this browser. Add it again.`);
        return null;
      }
      const result = await publish(layer.session, {
        changes: files.changes,
        message: commitMessage(action, slug),
        expectedHeadSha: baseSha,
      });
      const copy = publishCopy(result);
      this.#setJob(jobOf(result), copy.urgent ? copy.text : null);
      if (!copy.urgent) this.#toolbar.toolbar.announce(copy.text);
      return result;
    } finally {
      layer.busy = false;
    }
  }

  #setJob(job: JobStatus, alert: string | null = null): void {
    this.#toolbar.job = job;
    this.#layer.notice = alert;
    this.#toolbar.update();
  }
}

/** The draft back at its base: the repository version, nothing staged (Discard). */
export function baseDraft(draft: Draft): Draft | null {
  const file = projectFile(draft.slug);
  const text = draft.base.files[file] ?? null;
  const orderText = draft.base.files[CONTENT_FILES.order] ?? null;
  if (text === null || orderText === null) return null;
  const checked = validateProject(parseJson(text), file, validationContext(EDITOR_CONTEXT, []));
  if (!checked.ok) return null;
  return { ...draft, working: checked.value, order: readOrder(parseJson(orderText)), staged: [] };
}

const KEPT_NOTICE =
  'Your draft now sits on the latest commit. Publishing replaces the changes in those files.';

/** The toolbar's Publish and Discard, and what happens after each result (FR-397, FR-398). */
export class PublishFlow {
  readonly #layer: EditLayer;
  readonly #validation: Validation;
  readonly #toolbar: ToolbarController;
  readonly #publisher: Pick<Publisher, 'run'>;
  #watch: AbortController | null = null;

  constructor(
    layer: EditLayer,
    validation: Validation,
    toolbar: ToolbarController,
    publisher: Pick<Publisher, 'run'>,
  ) {
    this.#layer = layer;
    this.#validation = validation;
    this.#toolbar = toolbar;
    this.#publisher = publisher;
    layer.modal.addEventListener('editor:action', (event) => {
      if (event.detail.kind === 'publish') void this.publish();
      if (event.detail.kind === 'discard') void this.discard();
    });
    document.addEventListener('admin:signed-out', () => {
      this.#watch?.abort();
    });
  }

  /** Gate → build → publish → route (FR-395, FR-397). */
  async publish(): Promise<PublishResult | null> {
    const layer = this.#layer;
    const draft = layer.draft;
    const raw = layer.raw;
    if (draft === null || raw === null || layer.busy || layer.readOnly !== null) return null;
    await layer.store.flush();
    const built = this.#validation.now();
    if (built === null || built.gate === 'blocked') {
      this.#toolbar.toolbar.issuesOpen = true;
      return null;
    }
    if (built.changes.length === 0) return null;
    if (built.gate === 'confirm') {
      const warnings = built.issues.filter((i) => i.severity === 'warning');
      if ((await confirmDialog().ask(warningsConfirm(warnings))) !== 'publish') return null;
    }
    this.#watch?.abort();
    this.#toolbar.liveUrl = null;
    const result = await this.#publisher.run(
      built.changes,
      draft.action,
      draft.slug,
      draft.base.sha,
    );
    if (result === null) return null;
    switch (result.kind) {
      case 'ok':
        await this.#settle(draft, result.commitSha, built.changes);
        void this.#follow(draft.slug, result.commitSha, result.commitUrl);
        break;
      case 'unchanged':
        await this.#settle(draft, result.headSha, built.changes);
        break;
      case 'conflict':
        await this.#conflict(draft, result.reason === 'race' ? null : result.paths);
        break;
      default:
        break;
    }
    return result;
  }

  /** The commit is the new base; the stored draft and its blobs go (FR-385, FR-397). */
  async #settle(draft: Draft, sha: string, changes: readonly PlannedChange[]): Promise<void> {
    const layer = this.#layer;
    const raw = layer.raw;
    await layer.store.clear(draft.slug, draft.staged);
    const next = rebase(layer.draft ?? draft, sha, changes);
    layer.replaceDraft(next, raw === null ? null : applyContent(raw, contentOnly(changes)));
  }

  /** Conflict: Reload from repository, or Keep my draft on the new head (FR-397). A race keeps. */
  async #conflict(draft: Draft, paths: readonly string[] | null): Promise<void> {
    const choice = paths === null ? 'keep' : await confirmDialog().ask(conflictConfirm(paths));
    if (choice === 'cancel') return;
    const layer = this.#layer;
    const ctx = validationContext(EDITOR_CONTEXT, []);
    const reader = { readHead, readFile };
    const snap = await takeSnapshot(layer.session, draft.slug, layer.bundled, ctx, reader);
    if (snap.kind === 'failed') return;
    if (choice === 'reload') {
      await layer.store.clear(draft.slug, draft.staged);
      const fresh = draftFrom(draft.slug, snap);
      if (fresh !== null) layer.replaceDraft(fresh, snap.raw);
      return;
    }
    const current = layer.draft ?? draft;
    layer.replaceDraft({ ...current, base: { sha: snap.sha, files: snap.files } }, snap.raw);
    layer.notice = KEPT_NOTICE;
    this.#toolbar.update();
  }

  /** Deploy badge until Live, Failed, or Unknown; a new publish or Sign out aborts it (FR-398). */
  async #follow(slug: string, commitSha: string, commitUrl: string): Promise<void> {
    const watch = new AbortController();
    this.#watch = watch;
    try {
      for await (const deploy of watchDeploy(this.#layer.session, commitSha, {
        signal: watch.signal,
      })) {
        if (watch.signal.aborted) return;
        this.#toolbar.job = { kind: 'deploying', commitUrl, deploy };
        this.#toolbar.liveUrl = deploy.kind === 'live' ? workPath(slug) : null;
        this.#toolbar.update();
        const copy = deployCopy(deploy);
        this.#toolbar.toolbar.announce([copy.label, copy.detail].filter(Boolean).join('. '));
      }
    } catch {
      // An aborted or failed watch leaves the last state on the badge.
    }
  }

  /** Discard: drop the draft and its staged files, back to the repository version (FR-396). */
  async discard(): Promise<void> {
    const layer = this.#layer;
    const draft = layer.draft;
    if (draft === null || layer.busy) return;
    const answer = await confirmDialog().ask(discardConfirm(draft.slug, layer.changes));
    if (answer !== 'discard') return;
    await layer.store.clear(draft.slug, draft.staged);
    if (draft.action === 'create') {
      layer.modal.querySelector<HTMLButtonElement>('[data-close]')?.click();
      return;
    }
    const reset = baseDraft(draft);
    if (reset !== null) layer.replaceDraft(reset);
  }
}
