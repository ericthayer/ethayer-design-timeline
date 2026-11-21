import './styles/layers.css';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/header.css';
import './styles/static.css';
import { define as defineToggle } from './components/motion-toggle/motion-toggle.ts';
import type { DialogView, ProjectDialog } from './components/project-dialog/project-dialog.ts';
import { ProjectCard, define as defineCard } from './components/project-card/project-card.ts';
import type { ResumeDialog } from './components/resume-dialog/resume-dialog.ts';
import { renderFooter } from './components/site-footer/site-footer.ts';
import { define as defineArtwork } from './components/swiss-artwork/swiss-artwork.ts';
import { define as defineWall } from './components/timeline-wall/timeline-wall.ts';
import { define as defineViewSwitch, ViewSwitch } from './components/view-switch/view-switch.ts';
import { ERAS } from './content/eras.ts';
import { PROJECTS } from './content/projects/index.ts';
import { RESUME_TITLE, projectTitle } from './content/site.ts';
import { visibleProjects } from './core/drafts.ts';
import { getScheduler } from './core/media-scheduler.ts';
import { getMotion } from './core/motion.ts';
import { itemIndexOf } from './core/order.ts';
import { RESUME_PATH, Router, routerBase, type ViewId } from './core/router.ts';
import { SiteViews } from './views.ts';
import { morph } from './core/transition.ts';

defineArtwork();
defineCard();
defineToggle();
defineWall();
defineViewSwitch();

const base = routerBase(location.pathname);
// Drafts show in dev and under /admin only (spec 007, FR-600, FR-602).
const SHOWN = visibleProjects(PROJECTS, { includeDrafts: import.meta.env.DEV || base !== '' });

const views = new SiteViews(SHOWN, base);
const wall = views.wall;
const viewTitle = (): string => views.title;
let openSlug: string | null = null;
const status = document.getElementById('wall-status');
const motion = getMotion();
const scheduler = getScheduler();

// Media gates (FR-034)
scheduler.setGate('motion', motion.paused);
motion.subscribe((state) => {
  scheduler.setGate('motion', state === 'reduced');
});
const narrow = matchMedia('(max-width: 899px)');
scheduler.setGate('narrow', narrow.matches);
narrow.addEventListener('change', () => {
  scheduler.setGate('narrow', narrow.matches);
});
const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
scheduler.setGate('save-data', connection?.saveData === true);

document.getElementById('main')?.after(renderFooter());

function showView(next: ViewId): void {
  views.show(next);
  if (!openSlug) document.title = viewTitle();
}

// Dialog: loaded on first intent or open (FR-057)
let dialogPromise: Promise<ProjectDialog> | undefined;
function loadDialog(): Promise<ProjectDialog> {
  dialogPromise ??= import('./components/project-dialog/project-dialog.ts').then((mod) => {
    mod.define();
    const dialog = new mod.ProjectDialog();
    document.body.append(dialog);
    dialog.addEventListener('project-dialog:close', () => {
      router.close();
    });
    dialog.addEventListener('project-dialog:navigate', (event) => {
      step(event.detail.direction);
    });
    return dialog;
  });
  return dialogPromise;
}

// Résumé: loaded on first intent or open (FR-122)
let resumePromise: Promise<ResumeDialog> | undefined;
function loadResume(): Promise<ResumeDialog> {
  resumePromise ??= Promise.all([
    import('./components/resume-dialog/resume-dialog.ts'),
    import('./content/resume.ts'),
  ]).then(([mod, content]) => {
    mod.define();
    const dialog = new mod.ResumeDialog();
    dialog.resume = content.RESUME;
    document.body.append(dialog);
    dialog.addEventListener('resume-dialog:close', () => {
      router.close();
    });
    return dialog;
  });
  return resumePromise;
}

// Bumped by every open and close, so an open that resolves after a later Back bails (race fix).
let navigation = 0;
let resumeOpener: HTMLElement | null = null;
let projectOpener: ProjectCard | null = null;

async function openProject(slug: string): Promise<void> {
  const index = views.sequence.findIndex((p) => p.slug === slug);
  const project = views.sequence[index];
  if (!project) {
    if (status) status.textContent = 'Project not found.';
    router.reset();
    return;
  }
  const ticket = ++navigation;
  wall.renderThrough(itemIndexOf(views.items, slug));
  const dialog = await loadDialog();
  if (ticket !== navigation) return;
  const view: DialogView = {
    project,
    index: index + 1,
    total: views.sequence.length,
    era: ERAS.find((era) => era.id === project.era),
    prev: views.sequence[index - 1],
    next: views.sequence[index + 1],
  };
  scheduler.setGate('dialog', true);
  document.title = projectTitle(project.title);
  const firstOpen = !dialog.isOpen;
  openSlug = slug;
  if (firstOpen) {
    morph(
      () => {
        // The view-transition update runs a frame later; a close may have landed in between.
        if (openSlug !== slug) return;
        dialog.show(view);
      },
      (projectOpener ?? views.cardFor(slug))?.art,
      () => dialog.hero,
      !motion.paused,
    );
  } else {
    dialog.show(view);
  }
}

async function closeProject(): Promise<void> {
  navigation++;
  if (!openSlug) return;
  const card = projectOpener ?? views.cardFor(openSlug);
  projectOpener = null;
  openSlug = null;
  const dialog = await loadDialog();
  morph(
    () => {
      dialog.hide();
      (card?.isConnected ? card.link : views.focusTarget)?.focus();
    },
    dialog.hero,
    () => card?.art,
    !motion.paused,
  );
  scheduler.setGate('dialog', false);
  document.title = viewTitle();
}

async function openResume(): Promise<void> {
  if (openSlug) await closeProject();
  const dialog = await loadResume();
  scheduler.setGate('dialog', true);
  document.title = RESUME_TITLE;
  dialog.show();
}

async function closeResume(): Promise<void> {
  if (!resumePromise) return;
  const dialog = await resumePromise;
  if (!dialog.isOpen) return;
  dialog.hide();
  (resumeOpener?.isConnected ? resumeOpener : views.focusTarget).focus();
  resumeOpener = null;
  scheduler.setGate('dialog', false);
  document.title = viewTitle();
}

function step(direction: -1 | 1): void {
  const next = views.sequence[views.sequence.findIndex((p) => p.slug === openSlug) + direction];
  if (next) router.replace(next.slug);
}

const router = new Router({
  onView: showView,
  onOpen: (slug) => void openProject(slug),
  onResume: () => void openResume(),
  onClose: () => {
    void closeProject();
    void closeResume();
  },
});

wall.addEventListener('timeline:intent', () => void loadDialog());
wall.addEventListener('timeline:open', (event) => {
  router.open(event.detail.slug);
});

const plainClick = (event: MouseEvent): boolean =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

document.addEventListener('click', (event) => {
  const link = event.target instanceof Element ? event.target.closest('a') : null;
  const href = link?.getAttribute('href');
  if (!link || !plainClick(event)) return;
  if (link.matches('.site-home .card__link') && link.dataset['slug']) {
    event.preventDefault();
    const card = link.closest('project-card');
    projectOpener = card instanceof ProjectCard ? card : null;
    router.open(link.dataset['slug']);
  }
  // View switch: client-side, then hand the new wall focus (spec 006, FR-521)
  const target = ViewSwitch.viewOf(link);
  if (target) {
    event.preventDefault();
    const swap = (): void => {
      router.navigate(target);
      views.focusTarget.scrollIntoView({ block: 'start' });
      views.focusTarget.focus({ preventScroll: true });
    };
    if (!motion.paused && 'startViewTransition' in document) {
      document.startViewTransition(swap).ready.catch(() => undefined);
    } else swap();
  }
  // "Skip to end of timeline" renders the remaining batches first (FR-083)
  if (href === '#timeline-end') {
    event.preventDefault();
    wall.renderAll();
    document.getElementById('timeline-end-title')?.focus();
  }
  // Hero CTA: scroll to the wall and hand it focus (FR-103)
  if (href === '#wall' && link.classList.contains('site-hero__cta')) {
    event.preventDefault();
    wall.scrollIntoView({ behavior: motion.paused ? 'auto' : 'smooth', block: 'start' });
    wall.focus({ preventScroll: true });
  }
  // Résumé links open the dialog in place (FR-124)
  if (href === RESUME_PATH) {
    event.preventDefault();
    resumeOpener = link;
    router.openResume();
  }
});

const resumeIntent = (event: Event): void => {
  if (event.target instanceof Element && event.target.closest(`a[href="${RESUME_PATH}"]`))
    void loadResume();
};
document.addEventListener('pointerover', resumeIntent);
document.addEventListener('focusin', resumeIntent);

router.sync();
