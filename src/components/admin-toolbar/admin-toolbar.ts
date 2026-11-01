import { deployCopy } from '../../core/editor/copy.ts';
import {
  EMPTY_TOOLBAR,
  type ToolbarState,
  discardBlocked,
  issueText,
  issuesBlocked,
  publishBlocked,
  settingsBlocked,
  statusLine,
  undoBlocked,
} from '../../core/editor/toolbar.ts';
import { defineOnce, el } from '../../core/dom.ts';
import './admin-toolbar.css';

export type ToolbarAction =
  | { readonly kind: 'edit' | 'issues' | 'settings' | 'undo' | 'redo' | 'new' | 'discard' }
  | { readonly kind: 'publish' }
  | { readonly kind: 'go-to-field'; readonly index: number };

declare global {
  interface HTMLElementEventMap {
    'admin-toolbar:action': CustomEvent<ToolbarAction>;
  }
}

type ButtonKind = Exclude<ToolbarAction['kind'], 'go-to-field'>;
const BUTTONS: readonly { kind: ButtonKind; label: string }[] = [
  { kind: 'edit', label: 'Edit' },
  { kind: 'issues', label: 'Issues' },
  { kind: 'settings', label: 'Card settings' },
  { kind: 'undo', label: 'Undo' },
  { kind: 'redo', label: 'Redo' },
  { kind: 'new', label: 'New project' },
  { kind: 'discard', label: 'Discard' },
  { kind: 'publish', label: 'Publish' },
];

const ISSUES_ID = 'atb-issues';
/** The settings panel's id, so Card settings can name it in `aria-controls` (FR-388). */
export const PANEL_ID = 'ed-panel';

/**
 * <admin-toolbar>: the editor's controls and state (spec 004 edit-layer FR-396). It renders a
 * `ToolbarState` and reports intent through `admin-toolbar:action`; the layer decides. Plain Tab
 * order, no roving focus. A disabled control keeps focus and says why (`aria-disabled`).
 */
export class AdminToolbar extends HTMLElement {
  private readonly buttons = new Map<ButtonKind, HTMLButtonElement>();
  private readonly reasons = new Map<ButtonKind, HTMLSpanElement>();
  private readonly line = el('p', { class: 'atb__line' });
  private readonly deploy = el('p', { class: 'atb__deploy', hidden: true });
  private readonly drafts = el('nav', {
    class: 'atb__drafts',
    'aria-label': 'Local drafts',
    hidden: true,
  });
  private readonly issues = el('div', { id: ISSUES_ID, class: 'atb__issues', hidden: true });
  private readonly status = el('p', { class: 'visually-hidden', role: 'status' });
  private readonly alertRegion = el('p', { class: 'atb__alert', role: 'alert' });
  private stateValue: ToolbarState = EMPTY_TOOLBAR;
  private countTimer: ReturnType<typeof setTimeout> | null = null;

  connectedCallback(): void {
    if (this.firstChild) return;
    this.setAttribute('role', 'group');
    this.setAttribute('aria-label', 'Editor');
    const controls = el('div', { class: 'atb__controls' });
    for (const { kind, label } of BUTTONS) {
      const reason = el('span', { id: `atb-why-${kind}`, class: 'visually-hidden' });
      const button = el(
        'button',
        {
          type: 'button',
          class: kind === 'publish' ? 'atb__btn atb__btn--primary' : 'atb__btn',
          'data-action': kind,
        },
        [label],
      );
      this.buttons.set(kind, button);
      this.reasons.set(kind, reason);
      controls.append(button, reason);
      if (kind === 'edit') controls.append(this.line);
    }
    this.buttons.get('issues')?.setAttribute('aria-controls', ISSUES_ID);
    this.buttons.get('settings')?.setAttribute('aria-controls', PANEL_ID);
    controls.append(this.deploy);
    this.append(controls, this.drafts, this.issues, this.status, this.alertRegion);
    this.addEventListener('click', this.onClick);
    this.render();
  }

  get state(): ToolbarState {
    return this.stateValue;
  }

  set state(next: ToolbarState) {
    const counts = statusLine(next) !== statusLine(this.stateValue);
    const job = next.job.kind !== this.stateValue.job.kind;
    this.stateValue = next;
    if (!this.firstChild) return;
    this.render();
    if (job) this.announce(statusLine(next));
    else if (counts) this.announceCounts(statusLine(next));
  }

  /** Progress, now (FR-396). */
  announce(text: string): void {
    if (this.countTimer !== null) clearTimeout(this.countTimer);
    this.countTimer = null;
    this.status.textContent = text;
  }

  /** Count changes settle for 1 s before they're announced (FR-396). */
  private announceCounts(text: string): void {
    if (this.countTimer !== null) clearTimeout(this.countTimer);
    this.countTimer = setTimeout(() => {
      this.status.textContent = text;
      this.countTimer = null;
    }, 1000);
  }

  /** Failures that need action (FR-396). Empty text clears it. */
  alert(text: string): void {
    this.alertRegion.textContent = text;
  }

  /** The Issues disclosure's open state (FR-395). */
  get issuesOpen(): boolean {
    return !this.issues.hidden;
  }
  set issuesOpen(open: boolean) {
    this.issues.hidden = !open || this.stateValue.issues.length === 0;
    this.buttons.get('issues')?.setAttribute('aria-expanded', String(!this.issues.hidden));
  }

  /** The control for an action, so the layer can return focus to it. */
  control(kind: ButtonKind): HTMLButtonElement | undefined {
    return this.buttons.get(kind);
  }

  private render(): void {
    const s = this.stateValue;
    this.line.textContent = statusLine(s);
    this.buttons.get('edit')?.setAttribute('aria-pressed', String(s.editing));
    const issues = this.buttons.get('issues');
    if (issues)
      issues.textContent = s.issues.length > 0 ? `Issues (${String(s.issues.length)})` : 'Issues';
    this.buttons.get('settings')?.setAttribute('aria-expanded', String(s.panelOpen));
    this.block('issues', issuesBlocked(s));
    this.block('settings', settingsBlocked(s));
    this.block('undo', undoBlocked(s, false));
    this.block('redo', undoBlocked(s, true));
    this.block('discard', discardBlocked(s));
    this.block('publish', publishBlocked(s));
    this.issuesOpen = !this.issues.hidden;
    this.renderIssues(s);
    this.renderDeploy(s);
    this.renderDrafts(s);
  }

  private block(kind: ButtonKind, reason: string | null): void {
    const button = this.buttons.get(kind);
    const span = this.reasons.get(kind);
    if (!button || !span) return;
    span.textContent = reason ?? '';
    if (reason === null) {
      button.removeAttribute('aria-disabled');
      button.removeAttribute('aria-describedby');
    } else {
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-describedby', span.id);
    }
  }

  private renderIssues(s: ToolbarState): void {
    const items = s.issues.map((issue, index) =>
      el('li', { class: 'atb__issue', 'data-severity': issue.severity }, [
        el('span', {}, [issueText(issue)]),
        el('button', { type: 'button', class: 'atb__btn', 'data-issue': index }, ['Go to field']),
      ]),
    );
    this.issues.replaceChildren(
      el('h2', { class: 'visually-hidden' }, ['Issues']),
      el('ul', {}, items),
    );
  }

  private renderDeploy(s: ToolbarState): void {
    const job = s.job;
    this.deploy.hidden = job.kind !== 'deploying';
    if (job.kind !== 'deploying') {
      this.deploy.replaceChildren();
      return;
    }
    const copy = deployCopy(job.deploy);
    const link = (text: string, href: string): HTMLAnchorElement =>
      el('a', { href, target: '_blank', rel: 'noopener' }, [text]);
    this.deploy.replaceChildren(
      el('span', { class: 'atb__badge', 'data-deploy': job.deploy.kind }, [copy.label]),
      ...(copy.link ? [link(copy.link.text, copy.link.href)] : []),
      link('View commit', job.commitUrl),
      ...(s.liveUrl ? [link('View live', s.liveUrl)] : []),
      ...(copy.detail ? [el('span', {}, [copy.detail])] : []),
    );
  }

  private renderDrafts(s: ToolbarState): void {
    const others = s.localDrafts.filter((slug) => slug !== s.slug);
    this.drafts.hidden = others.length === 0;
    this.drafts.replaceChildren(
      'Local drafts: ',
      ...others.flatMap((slug, i) => [
        ...(i > 0 ? [', '] : []),
        el('a', { href: `/admin/work/${slug}` }, [slug]),
      ]),
    );
  }

  private readonly onClick = (event: MouseEvent): void => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || !this.contains(button) || button.getAttribute('aria-disabled') === 'true')
      return;
    const issue = button.dataset['issue'];
    const kind = button.dataset['action'];
    const known = BUTTONS.find((b) => b.kind === kind)?.kind;
    const action: ToolbarAction | null =
      issue !== undefined
        ? { kind: 'go-to-field', index: Number(issue) }
        : known === undefined
          ? null
          : { kind: known };
    if (action)
      this.dispatchEvent(
        new CustomEvent('admin-toolbar:action', { detail: action, bubbles: true }),
      );
  };
}

export function define(): void {
  defineOnce('admin-toolbar', AdminToolbar);
}
