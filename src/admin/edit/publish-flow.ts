// Publishing a planned change set (spec 004 edit-layer FR-394, FR-397). One commit per run;
// repeat runs while one is in flight are ignored, and every failure keeps the draft.
import type { PlannedChange } from '../../core/editor/changes.ts';
import { publishCopy } from '../../core/editor/copy.ts';
import type { JobStatus } from '../../core/editor/toolbar.ts';
import { commitMessage, publish } from '../../core/github/index.ts';
import type { FileChange, PublishResult } from '../../core/github/types.ts';
import type { DraftStore } from './draft-store.ts';
import type { EditLayer } from './edit-layer.ts';
import type { ToolbarController } from './toolbar-wiring.ts';

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
