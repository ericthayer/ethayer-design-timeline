/** History API routes (FR-060): '/' is the wall, '/work/:slug' opens the dialog. */
const WORK = /^\/work\/([a-z0-9-]+)\/?$/;

export function parseSlug(pathname: string): string | null {
  return WORK.exec(pathname)?.[1] ?? null;
}

export const workPath = (slug: string): string => `/work/${slug}`;

interface RouteState {
  readonly slug: string;
  readonly pushedByApp: boolean;
}

const isRouteState = (value: unknown): value is RouteState =>
  typeof value === 'object' && value !== null && 'slug' in value && 'pushedByApp' in value;

export interface RouterHandlers {
  onOpen(slug: string): void;
  onClose(): void;
}

export class Router {
  constructor(private readonly handlers: RouterHandlers) {
    addEventListener('popstate', () => {
      this.sync();
    });
  }

  /** Apply the current URL (initial load and Back/Forward). */
  sync(): void {
    const slug = parseSlug(location.pathname);
    if (slug) this.handlers.onOpen(slug);
    else this.handlers.onClose();
  }

  /** Opening from the wall pushes one entry. */
  open(slug: string): void {
    history.pushState({ slug, pushedByApp: true } satisfies RouteState, '', workPath(slug));
    this.handlers.onOpen(slug);
  }

  /** Prev/Next replaces the entry so Back still returns to the wall. */
  replace(slug: string): void {
    const pushedByApp = isRouteState(history.state) && history.state.pushedByApp;
    history.replaceState({ slug, pushedByApp } satisfies RouteState, '', workPath(slug));
    this.handlers.onOpen(slug);
  }

  /** Closing pops the entry the app pushed (popstate then closes); a deep link replaces '/'. */
  close(): void {
    if (isRouteState(history.state) && history.state.pushedByApp) {
      history.back();
      return;
    }
    history.replaceState(null, '', '/');
    this.handlers.onClose();
  }

  /** Leave an unknown /work/ URL without adding history. */
  reset(): void {
    history.replaceState(null, '', '/');
  }
}
