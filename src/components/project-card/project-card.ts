import type { Project } from '../../content/types.ts';
import { defineOnce } from '../../core/dom.ts';
import { getScheduler, type MediaLease } from '../../core/media-scheduler.ts';
import { renderCardMedia } from '../card-media/card-media.ts';
import { buildStandard, buildSwiss } from './anatomy.ts';
import './project-card.css';

/**
 * <project-card>: one project as a Swiss poster or a standard media tile (FR-010–FR-018).
 * Set `project` before connecting. Live media registers with the scheduler while connected.
 */
export class ProjectCard extends HTMLElement {
  project: Project | undefined;
  /** First wall items load eagerly (FR-030). */
  eager = false;
  private lease: MediaLease | undefined;
  private release: (() => void) | undefined;
  private artZone: HTMLElement | undefined;

  connectedCallback(): void {
    if (!this.project) return;
    if (!this.artZone) this.render(this.project);
    if (this.lease && this.artZone && !this.release) {
      this.release = getScheduler().register(this.artZone, this.lease);
    }
  }

  disconnectedCallback(): void {
    this.release?.();
    this.release = undefined;
  }

  /** The art zone, used as the view-transition source for the dialog hero (FR-056). */
  get art(): HTMLElement | undefined {
    return this.artZone;
  }

  get link(): HTMLAnchorElement | null {
    return this.querySelector('.card__link');
  }

  private render(project: Project): void {
    const anatomy = project.treatment === 'swiss' ? buildSwiss(project) : buildStandard(project);
    const media = renderCardMedia(project, { eager: this.eager });
    anatomy.art.append(media.element);
    this.lease = media.lease;
    this.artZone = anatomy.art;
    this.dataset['slug'] = project.slug;
    this.replaceChildren(anatomy.article);
  }
}

export function define(): void {
  defineOnce('project-card', ProjectCard);
}
