import './styles/layers.css';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/header.css';
import './styles/static.css';
import { define as defineToggle } from './components/motion-toggle/motion-toggle.ts';
import type { DialogView, ProjectDialog } from './components/project-dialog/project-dialog.ts';
import { define as defineCard } from './components/project-card/project-card.ts';
import { define as defineArtwork } from './components/swiss-artwork/swiss-artwork.ts';
import { define as defineWall, TimelineWall } from './components/timeline-wall/timeline-wall.ts';
import { ERAS } from './content/eras.ts';
import { PROJECTS } from './content/projects/index.ts';
import { HOME_TITLE, projectTitle } from './content/site.ts';
import { getScheduler } from './core/media-scheduler.ts';
import { getMotion } from './core/motion.ts';
import { buildWallItems, itemIndexOf, projectSequence } from './core/order.ts';
import { Router } from './core/router.ts';
import { morph } from './core/transition.ts';

defineArtwork();
defineCard();
defineToggle();
defineWall();

const items = buildWallItems(PROJECTS, ERAS);
const sequence = projectSequence(items);
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

// Wall
const wall = new TimelineWall();
wall.items = items;
wall.status = status;
wall.id = 'wall';
document.getElementById('main')?.append(wall);

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

let openSlug: string | null = null;

async function openProject(slug: string): Promise<void> {
  const index = sequence.findIndex((p) => p.slug === slug);
  const project = sequence[index];
  if (!project) {
    if (status) status.textContent = 'Project not found.';
    router.reset();
    return;
  }
  wall.renderThrough(itemIndexOf(items, slug));
  const dialog = await loadDialog();
  const view: DialogView = {
    project,
    index: index + 1,
    total: sequence.length,
    era: ERAS.find((era) => era.id === project.era),
    prev: sequence[index - 1],
    next: sequence[index + 1],
  };
  scheduler.setGate('dialog', true);
  document.title = projectTitle(project.title);
  const firstOpen = !dialog.isOpen;
  openSlug = slug;
  if (firstOpen) {
    morph(
      () => {
        dialog.show(view);
      },
      wall.cardFor(slug)?.art,
      () => dialog.hero,
      !motion.paused,
    );
  } else {
    dialog.show(view);
  }
}

async function closeProject(): Promise<void> {
  if (!openSlug) return;
  const card = wall.cardFor(openSlug);
  openSlug = null;
  const dialog = await loadDialog();
  morph(
    () => {
      dialog.hide();
      card?.link?.focus();
    },
    dialog.hero,
    () => card?.art,
    !motion.paused,
  );
  scheduler.setGate('dialog', false);
  document.title = HOME_TITLE;
}

function step(direction: -1 | 1): void {
  const next = sequence[sequence.findIndex((p) => p.slug === openSlug) + direction];
  if (next) router.replace(next.slug);
}

const router = new Router({
  onOpen: (slug) => void openProject(slug),
  onClose: () => void closeProject(),
});

wall.addEventListener('timeline:intent', () => void loadDialog());
wall.addEventListener('timeline:open', (event) => {
  router.open(event.detail.slug);
});

// "Skip to end of timeline" renders the remaining batches first (FR-083)
document.addEventListener('click', (event) => {
  const link =
    event.target instanceof Element ? event.target.closest('a[href="#timeline-end"]') : null;
  if (!link) return;
  event.preventDefault();
  wall.renderAll();
  document.getElementById('timeline-end')?.focus();
});

router.sync();
