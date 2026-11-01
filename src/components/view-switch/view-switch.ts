import { defineOnce } from '../../core/dom.ts';
import { VIEW_PATHS, type ViewId } from '../../core/router.ts';
import './view-switch.css';

const isView = (value: string | undefined): value is ViewId =>
  value === 'experience' || value === 'projects';

/**
 * <view-switch>: progressive enhancement of the header's "Views" nav (spec 006, FR-520). The
 * links are static HTML, so they work without JavaScript; this marks the current one and keeps
 * hrefs under the router base (/admin).
 */
export class ViewSwitch extends HTMLElement {
  private view: ViewId = 'experience';

  get current(): ViewId {
    return this.view;
  }

  set current(view: ViewId) {
    this.view = view;
    for (const link of this.links()) {
      if (link.dataset['view'] === view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  /** Prefix every link with the router base, e.g. '/admin' → '/admin/projects'. */
  set base(base: string) {
    for (const link of this.links()) {
      const view = link.dataset['view'];
      if (!isView(view)) continue;
      link.href = view === 'experience' ? base || '/' : base + VIEW_PATHS[view];
    }
  }

  /** The view a click lands on, when it is one of this switch's links. */
  static viewOf(target: EventTarget | null): ViewId | null {
    const link = target instanceof Element ? target.closest('view-switch a[data-view]') : null;
    const view = link instanceof HTMLElement ? link.dataset['view'] : undefined;
    return isView(view) ? view : null;
  }

  private links(): HTMLAnchorElement[] {
    return [...this.querySelectorAll<HTMLAnchorElement>('a[data-view]')];
  }
}

export function define(): void {
  defineOnce('view-switch', ViewSwitch);
}
