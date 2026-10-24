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
export { renderEndCap, renderEra } from './components/wall-tiles/wall-tiles.ts';
export { renderHero, renderHeroArt } from './components/site-hero/site-hero.ts';
export { renderPlaceholder } from './components/card-media/placeholder.ts';
export { MediaScheduler, getScheduler, type MediaLease } from './core/media-scheduler.ts';
export { Motion, getMotion } from './core/motion.ts';
export { buildWallItems, projectSequence } from './core/order.ts';
export { Router, isResumePath, parseSlug } from './core/router.ts';
export { cascade } from './core/cascade.ts';
export { RESUME } from './content/resume.ts';
export type * from './content/types.ts';
