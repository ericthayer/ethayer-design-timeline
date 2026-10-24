/**
 * History API routes (FR-060, spec 002 FR-124): '/' is the wall, '/work/:slug' opens the
 * project dialog, and '/resume' opens the résumé dialog.
 */
const WORK = /^\/work\/([a-z0-9-]+)\/?$/;
const RESUME = /^\/resume\/?$/;
export const RESUME_PATH = '/resume';

export function parseSlug(pathname: string): string | null {
  return WORK.exec(pathname)?.[1] ?? null;
}

export const isResumePath = (pathname: string): boolean => RESUME.test(pathname);

export const workPath = (slug: string): string => `/work/${slug}`;

interface RouteState {
  readonly path: string;
  readonly pushedByApp: boolean;
}

const isRouteState = (value: unknown): value is RouteState =>
  typeof value === 'object' && value !== null && 'path' in value && 'pushedByApp' in value;

export interface RouterHandlers {
  onOpen(slug: string): void;
  onResume(): void;
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
    else if (isResumePath(location.pathname)) this.handlers.onResume();
    else this.handlers.onClose();
  }

  /** Opening from the wall pushes one entry. */
  open(slug: string): void {
    const path = workPath(slug);
    history.pushState({ path, pushedByApp: true } satisfies RouteState, '', path);
    this.handlers.onOpen(slug);
  }

  openResume(): void {
    history.pushState(
      { path: RESUME_PATH, pushedByApp: true } satisfies RouteState,
      '',
      RESUME_PATH,
    );
    this.handlers.onResume();
  }

  /** Prev/Next replaces the entry so Back still returns to the wall. */
  replace(slug: string): void {
    const path = workPath(slug);
    const pushedByApp = isRouteState(history.state) && history.state.pushedByApp;
    history.replaceState({ path, pushedByApp } satisfies RouteState, '', path);
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
