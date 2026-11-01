/** Public ES module surface (constitution III.1). Import a class and call its define(). */
export {
  MotionToggle,
  define as defineMotionToggle,
} from './components/motion-toggle/motion-toggle.ts';
export {
  ProjectCard,
  define as defineProjectCard,
} from './components/project-card/project-card.ts';
export {
  ProjectDialog,
  define as defineProjectDialog,
  type DialogView,
} from './components/project-dialog/project-dialog.ts';
export {
  ResumeDialog,
  define as defineResumeDialog,
} from './components/resume-dialog/resume-dialog.ts';
export {
  SwissArtwork,
  define as defineSwissArtwork,
  renderArtwork,
} from './components/swiss-artwork/swiss-artwork.ts';
export {
  TimelineWall,
  define as defineTimelineWall,
} from './components/timeline-wall/timeline-wall.ts';
export {
  ViewSwitch,
  define as defineViewSwitch,
} from './components/view-switch/view-switch.ts';
export { renderCategory, renderEndCap, renderEra } from './components/wall-tiles/wall-tiles.ts';
export { renderHero, renderHeroArt } from './components/site-hero/site-hero.ts';
export { renderPlaceholder } from './components/card-media/placeholder.ts';
export { MediaScheduler, getScheduler, type MediaLease } from './core/media-scheduler.ts';
export { Motion, getMotion } from './core/motion.ts';
export { buildCategoryItems, buildWallItems, projectSequence } from './core/order.ts';
export {
  Router,
  VIEW_PATHS,
  isResumePath,
  parseSlug,
  viewOfPath,
  type ViewId,
} from './core/router.ts';
export { CATEGORIES, CATEGORY_IDS, type Category, type CategoryId } from './content/categories.ts';
export { cascade } from './core/cascade.ts';
export { RESUME } from './content/resume.ts';
export type * from './content/types.ts';
// Admin-only (spec 004 admin-auth). This barrel isn't in the public page graph (FR-341).
export {
  AdminSignIn,
  define as defineAdminSignIn,
} from './components/admin-sign-in/admin-sign-in.ts';
export {
  AdminStatus,
  buildIsland,
  define as defineAdminStatus,
} from './components/admin-status/admin-status.ts';
