/**
 * History API routes (FR-060, spec 002 FR-124, spec 006 FR-521/FR-530): '/' is the Experience
 * wall, '/projects' the Projects wall, '/work/:slug' opens the project dialog over the current
 * view, and '/resume' opens the résumé dialog. Inside the admin entry the same routes live under
 * the '/admin' base (spec 004 FR-342).
 */
const WORK = /^\/work\/([a-z0-9-]+)\/?$/;
const RESUME = /^\/resume\/?$/;
export const RESUME_PATH = '/resume';
const PROJECTS = /^\/projects\/?$/;

export type ViewId = 'experience' | 'projects';
export const VIEW_PATHS: Readonly<Record<ViewId, string>> = {
  experience: '/',
  projects: '/projects',
};

/** The view a path shows by itself, or `null` for dialog routes (they keep the current view). */
export function viewOfPath(pathname: string): ViewId | null {
  if (PROJECTS.test(pathname)) return 'projects';
  return pathname === '/' || pathname === '' ? 'experience' : null;
}

const isView = (value: unknown): value is ViewId => value === 'experience' || value === 'projects';

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
  /** The view under a dialog, so Back and Close return to it (spec 006 FR-530). */
  readonly view?: ViewId;
}

const isRouteState = (value: unknown): value is RouteState =>
  typeof value === 'object' && value !== null && 'path' in value && 'pushedByApp' in value;

export interface RouterHandlers {
  /** Runs before the other handler on every sync, so the wall matches the URL first. */
  onView(view: ViewId): void;
  onOpen(slug: string): void;
  onResume(): void;
  onClose(): void;
}

export class Router {
  private current: ViewId = 'experience';

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
    const stateView = isRouteState(history.state) ? history.state.view : undefined;
    this.current = viewOfPath(pathname) ?? (isView(stateView) ? stateView : 'experience');
    this.handlers.onView(this.current);
    const slug = parseSlug(pathname);
    if (slug) this.handlers.onOpen(slug);
    else if (isResumePath(pathname)) this.handlers.onResume();
    else this.handlers.onClose();
  }

  get view(): ViewId {
    return this.current;
  }

  /** The view switch pushes one entry (spec 006 FR-521). */
  navigate(view: ViewId): void {
    if (view === this.current) return;
    const path = this.viewPath(view);
    history.pushState({ path, pushedByApp: true, view } satisfies RouteState, '', path);
    this.current = view;
    this.handlers.onView(view);
  }

  /** Opening from the wall pushes one entry. */
  open(slug: string): void {
    const path = this.base + workPath(slug);
    const state: RouteState = { path, pushedByApp: true, view: this.current };
    history.pushState(state, '', path);
    this.handlers.onOpen(slug);
  }

  openResume(): void {
    const path = this.base + RESUME_PATH;
    history.pushState(
      { path, pushedByApp: true, view: this.current } satisfies RouteState,
      '',
      path,
    );
    this.handlers.onResume();
  }

  /** Prev/Next replaces the entry so Back still returns to the wall. */
  replace(slug: string): void {
    const path = this.base + workPath(slug);
    const pushedByApp = isRouteState(history.state) && history.state.pushedByApp;
    history.replaceState({ path, pushedByApp, view: this.current } satisfies RouteState, '', path);
    this.handlers.onOpen(slug);
  }

  /** Closing pops the entry the app pushed (popstate then closes); a deep link replaces '/'. */
  close(): void {
    if (isRouteState(history.state) && history.state.pushedByApp) {
      history.back();
      return;
    }
    history.replaceState(null, '', this.viewPath(this.current));
    this.handlers.onClose();
  }

  /** Leave an unknown /work/ URL without adding history. */
  reset(): void {
    history.replaceState(null, '', this.viewPath(this.current));
  }

  private viewPath(view: ViewId): string {
    return view === 'experience' ? this.base || '/' : this.base + VIEW_PATHS[view];
  }
}
