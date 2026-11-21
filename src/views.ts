import { ProjectCard } from './components/project-card/project-card.ts';
import { renderHome } from './components/site-home/site-home.ts';
import { renderHero } from './components/site-hero/site-hero.ts';
import { TimelineWall } from './components/timeline-wall/timeline-wall.ts';
import { ViewSwitch } from './components/view-switch/view-switch.ts';
import { CATEGORIES } from './content/categories.ts';
import { ERAS } from './content/eras.ts';
import { EXPERIENCE_TITLE, HOME_TITLE, PROJECTS_TITLE } from './content/site.ts';
import type { Project } from './content/types.ts';
import { getScheduler } from './core/media-scheduler.ts';
import { el } from './core/dom.ts';
import { buildCategoryItems, buildWallItems, projectSequence } from './core/order.ts';
import type { ViewId } from './core/router.ts';

/** The page under the dialogs. Keep the wall mounted so its observers retain their lifecycle. */
export class SiteViews {
  readonly wall = new TimelineWall();
  private readonly timeline;
  private readonly categories;
  private readonly hero;
  private readonly end = el('span', { id: 'timeline-end', tabindex: '-1' });
  private home: HTMLElement | undefined;
  private current: ViewId | undefined;
  private readonly main: HTMLElement;
  private readonly switcher = document.querySelector('view-switch');

  constructor(
    private readonly projects: readonly Project[],
    base: string,
  ) {
    const main = document.getElementById('main');
    if (!main) throw new Error('The app shell is missing its main region.');
    this.main = main;
    this.timeline = buildWallItems(projects, ERAS);
    this.categories = buildCategoryItems(projects, ERAS, CATEGORIES);
    this.hero = renderHero(projects.length);
    this.wall.status = document.getElementById('wall-status');
    this.wall.id = 'wall';
    this.wall.setAttribute('role', 'region');
    this.wall.tabIndex = -1;
    this.wall.hidden = this.hero.hidden = this.end.hidden = true;
    this.main.append(this.hero, this.wall, this.end);
    if (this.switcher instanceof ViewSwitch) this.switcher.base = base;
  }

  get items(): ReturnType<typeof buildWallItems> {
    return this.current === 'projects' ? this.categories : this.timeline;
  }

  get sequence(): Project[] {
    return projectSequence(this.items);
  }

  get title(): string {
    return this.current === 'overview'
      ? HOME_TITLE
      : this.current === 'projects'
        ? PROJECTS_TITLE
        : EXPERIENCE_TITLE;
  }

  get focusTarget(): HTMLElement {
    return this.current === 'overview' ? this.main : this.wall;
  }

  show(next: ViewId): void {
    if (this.switcher instanceof ViewSwitch) this.switcher.current = next;
    for (const link of document.querySelectorAll<HTMLElement>('[data-view-only]')) {
      link.hidden = link.dataset['viewOnly'] !== next;
    }
    const skip = document.querySelector<HTMLAnchorElement>('.skip-link');
    if (skip) skip.href = next === 'overview' ? '#selected' : '#wall';
    if (next === this.current) return;
    this.current = next;
    const overview = next === 'overview';
    this.wall.hidden = this.hero.hidden = this.end.hidden = overview;
    if (overview) {
      getScheduler().setRoot(null);
      this.home ??= renderHome(this.projects);
      this.main.prepend(this.home);
    } else {
      this.home?.remove();
      this.wall.label = next === 'projects' ? 'Projects by category' : 'Projects, newest first';
      this.wall.setAttribute(
        'aria-label',
        next === 'projects' ? 'Projects by category' : 'Career timeline',
      );
      this.wall.replaceItems(this.items);
    }
    // A link from a homepage category/role must reach even a batched wall marker.
    if (location.hash && !overview) {
      this.wall.renderAll();
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      requestAnimationFrame(() => target?.scrollIntoView({ block: 'start', inline: 'start' }));
    }
  }

  cardFor(slug: string): ProjectCard | null {
    if (this.current !== 'overview') return this.wall.cardFor(slug);
    const card = this.home?.querySelector(`project-card[data-slug="${CSS.escape(slug)}"]`);
    return card instanceof ProjectCard ? card : null;
  }
}
