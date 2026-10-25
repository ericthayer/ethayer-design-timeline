/**
 * History API routes (FR-060, spec 002 FR-124): '/' is the wall, '/work/:slug' opens the
 * project dialog, and '/resume' opens the résumé dialog. Inside the admin entry the same routes
 * live under the '/admin' base (spec 004 FR-342).
 */
const WORK = /^\/work\/([a-z0-9-]+)\/?$/;
const RESUME = /^\/resume\/?$/;
export const RESUME_PATH = '/resume';

export function parseSlug(pathname: string): string | null {
  return WORK.exec(pathname)?.[1] ?? null;
}

export const isResumePath = (pathname: string): boolean => RESUME.test(pathname);

export const workPath = (slug: string): string => `/work/${slug}`;

/** '/admin' for /admin and /admin/*, otherwise '' (spec 004 FR-342). */
export const routerBase = (pathname: string): string =>
  /^\/admin(\/|$)/.test(pathname) ? '/admin' : '';

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
  constructor(
    private readonly handlers: RouterHandlers,
    private readonly base = routerBase(location.pathname),
  ) {
    addEventListener('popstate', () => {
      this.sync();
    });
  }

  /** Apply the current URL (initial load and Back/Forward). */
  sync(): void {
    const pathname = location.pathname.slice(this.base.length) || '/';
    const slug = parseSlug(pathname);
    if (slug) this.handlers.onOpen(slug);
    else if (isResumePath(pathname)) this.handlers.onResume();
    else this.handlers.onClose();
  }

  /** Opening from the wall pushes one entry. */
  open(slug: string): void {
    const path = this.base + workPath(slug);
    history.pushState({ path, pushedByApp: true } satisfies RouteState, '', path);
    this.handlers.onOpen(slug);
  }

  openResume(): void {
    const path = this.base + RESUME_PATH;
    history.pushState({ path, pushedByApp: true } satisfies RouteState, '', path);
    this.handlers.onResume();
  }

  /** Prev/Next replaces the entry so Back still returns to the wall. */
  replace(slug: string): void {
    const path = this.base + workPath(slug);
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
    history.replaceState(null, '', this.base || '/');
    this.handlers.onClose();
  }

  /** Leave an unknown /work/ URL without adding history. */
  reset(): void {
    history.replaceState(null, '', this.base || '/');
  }
}
