// <admin-toolbar> and its state copy (spec 004 edit-layer FR-396, T386).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdminToolbar,
  type ToolbarAction,
  define,
} from '../../../src/components/admin-toolbar/admin-toolbar.ts';
import {
  EMPTY_TOOLBAR,
  type ToolbarState,
  publishBlocked,
  statusLine,
} from '../../../src/core/editor/toolbar.ts';
import { issue } from '../../../src/content/validate/issue.ts';
import { projectFile } from '../../../src/content/paths.ts';

afterEach(() => {
  vi.useRealTimers();
});

const open = (over: Partial<ToolbarState> = {}): ToolbarState => ({
  ...EMPTY_TOOLBAR,
  slug: 'dmns',
  ...over,
});
const error = issue('text-length', projectFile('dmns'), '/title', 'dmns', 'the title is empty');
const warning = issue('swiss-share', projectFile('dmns'), '', 'dmns', 'too few Swiss cards');

describe('toolbar copy (FR-396)', () => {
  it('reads the status line from the counts', () => {
    expect(statusLine(open())).toBe('All changes published');
    expect(statusLine(open({ draft: { changes: 4, errors: 2, warnings: 1 } }))).toBe(
      '4 unsaved changes · 2 errors · 1 warning',
    );
    expect(statusLine(open({ draft: { changes: 1, errors: 0, warnings: 0 } }))).toBe(
      '1 unsaved change',
    );
    expect(statusLine(open({ job: { kind: 'publishing', files: 3 } }))).toBe('Publishing 3 files…');
    expect(statusLine(EMPTY_TOOLBAR)).toBe('Open a project to edit it.');
  });

  it('says why Publish is unavailable', () => {
    expect(publishBlocked(open({ draft: { changes: 2, errors: 2, warnings: 0 } }))).toBe(
      'Fix 2 errors to publish.',
    );
    expect(publishBlocked(open())).toBe('Nothing to publish yet.');
    expect(publishBlocked(open({ draft: { changes: 1, errors: 0, warnings: 1 } }))).toBeNull();
  });
});

function mount(state: ToolbarState): { bar: AdminToolbar; actions: ToolbarAction[] } {
  define();
  document.body.replaceChildren();
  const bar = new AdminToolbar();
  bar.state = state;
  document.body.append(bar);
  const actions: ToolbarAction[] = [];
  bar.addEventListener('admin-toolbar:action', (e) => actions.push(e.detail));
  return { bar, actions };
}

describe('<admin-toolbar> (FR-396)', () => {
  it('is a labeled group of labeled buttons in plain Tab order', () => {
    const { bar } = mount(open());
    expect(bar.getAttribute('role')).toBe('group');
    expect(bar.getAttribute('aria-label')).toBe('Editor');
    const buttons = [...bar.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Edit',
      'Issues',
      'Card settings',
      'Undo',
      'Redo',
      'New project',
      'Discard',
      'Publish',
    ]);
    expect(buttons.every((b) => b.tabIndex === 0 && !b.disabled)).toBe(true);
    expect(bar.querySelector('[data-action="edit"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks disabled controls with aria-disabled and a reason, and ignores their clicks', () => {
    const { bar, actions } = mount(
      open({ draft: { changes: 1, errors: 1, warnings: 0 }, issues: [error] }),
    );
    const publish = bar.control('publish');
    expect(publish?.getAttribute('aria-disabled')).toBe('true');
    const why = document.getElementById(publish?.getAttribute('aria-describedby') ?? '');
    expect(why?.textContent).toBe('Fix 1 error to publish.');
    publish?.click();
    bar.control('discard')?.click();
    expect(actions).toEqual([{ kind: 'discard' }]);
  });

  it('opens the Issues disclosure with a Go to field button per issue', () => {
    const { bar, actions } = mount(open({ issues: [error, warning] }));
    const toggle = bar.control('issues');
    expect(toggle?.textContent).toBe('Issues (2)');
    bar.issuesOpen = true;
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    const items = [...bar.querySelectorAll('.atb__issue')].map((li) => li.textContent);
    expect(items).toEqual([
      'Error: the title is emptyGo to field',
      'Warning: too few Swiss cardsGo to field',
    ]);
    bar.querySelector<HTMLButtonElement>('[data-issue="1"]')?.click();
    expect(actions).toEqual([{ kind: 'go-to-field', index: 1 }]);
  });

  it('debounces count announcements by 1 s, and links other local drafts', () => {
    vi.useFakeTimers();
    const { bar } = mount(open({ localDrafts: ['dmns', 'curiteva'] }));
    const status = bar.querySelector('[role="status"]');
    bar.state = open({ draft: { changes: 1, errors: 0, warnings: 0 } });
    bar.state = open({ draft: { changes: 2, errors: 0, warnings: 0 } });
    expect(status?.textContent).toBe('');
    vi.advanceTimersByTime(1000);
    expect(status?.textContent).toBe('2 unsaved changes');
    bar.state = open({ localDrafts: ['dmns', 'curiteva'] });
    const links = [...bar.querySelectorAll('.atb__drafts a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/admin/work/curiteva']);
  });

  it('shows the deploy badge with View commit and View live', () => {
    const { bar } = mount(
      open({
        job: {
          kind: 'deploying',
          commitUrl: 'https://github.com/c',
          deploy: { kind: 'live', logUrl: null },
        },
        liveUrl: '/work/dmns',
      }),
    );
    expect(bar.querySelector('.atb__badge')?.textContent).toBe('Live');
    expect([...bar.querySelectorAll('.atb__deploy a')].map((a) => a.textContent)).toEqual([
      'View commit',
      'View live',
    ]);
  });
});
