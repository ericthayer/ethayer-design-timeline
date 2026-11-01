import type { WallItem } from '../../content/types.ts';
import { defineOnce, el } from '../../core/dom.ts';
import { getScheduler } from '../../core/media-scheduler.ts';
import { isNavKey, nextIndex } from '../../core/spatial-nav.ts';
import { attachWheelToHorizontal, wallOwnsWheel } from '../../core/wheel.ts';
import { ProjectCard } from '../project-card/project-card.ts';
import { renderEndCap, renderEra } from '../wall-tiles/wall-tiles.ts';
import './timeline-wall.css';

declare global {
  interface HTMLElementEventMap {
    'timeline:open': CustomEvent<{ readonly slug: string }>;
    'timeline:intent': CustomEvent<null>;
  }
}

const EAGER_ITEMS = 4;

/**
 * <timeline-wall>: the bento grid (FR-001–FR-007), batch loading (FR-070–FR-073), wheel
 * mapping (FR-005) and arrow-key navigation (FR-081). Layout lives in CSS; JS reads the mode.
 */
export class TimelineWall extends HTMLElement {
  items: readonly WallItem[] = [];
  batchSize = 12;
  status: HTMLElement | null = null;
  private readonly grid = el('ol', { class: 'wall__grid', 'aria-label': 'Projects, newest first' });
  private rendered = 0;
  private loader: IntersectionObserver | undefined;
  private horizontal = false;
  private intentSent = false;
  private resizeObserver: ResizeObserver | undefined;

  connectedCallback(): void {
    if (this.grid.isConnected) return;
    this.append(this.grid);
    this.renderCount(this.batchSize, false);
    attachWheelToHorizontal(
      this.grid,
      (event) =>
        this.horizontal &&
        wallOwnsWheel(this.grid.getBoundingClientRect().top, this.grid.scrollLeft, event.deltaY),
    );
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKeydown);
    this.addEventListener('pointerover', this.onIntent);
    this.addEventListener('focusin', this.onIntent);
    this.resizeObserver = new ResizeObserver(() => {
      this.syncMode();
    });
    this.resizeObserver.observe(this);
    this.syncMode();
  }

  disconnectedCallback(): void {
    this.loader?.disconnect();
    this.resizeObserver?.disconnect();
  }

  get isHorizontal(): boolean {
    return this.horizontal;
  }

  /** Render batches until `itemIndex` exists (deep links, FR-053). */
  renderThrough(itemIndex: number): void {
    if (itemIndex >= this.rendered) this.renderCount(itemIndex + 1 - this.rendered, true);
  }

  renderAll(): void {
    this.renderThrough(this.items.length - 1);
  }

  cardFor(slug: string): ProjectCard | null {
    const card = this.grid.querySelector(`project-card[data-slug="${CSS.escape(slug)}"]`);
    return card instanceof ProjectCard ? card : null;
  }

  /** CSS decides the mode (container query); JS mirrors it for wheel and observer roots. */
  private syncMode(): void {
    const horizontal = getComputedStyle(this.grid).gridAutoFlow.startsWith('column');
    if (horizontal === this.horizontal && this.dataset['mode']) return;
    this.horizontal = horizontal;
    this.dataset['mode'] = horizontal ? 'horizontal' : 'vertical';
    getScheduler().setRoot(horizontal ? this.grid : null);
    this.observeTail();
    const focused = this.grid.contains(document.activeElement) ? document.activeElement : null;
    focused?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  private observeTail(): void {
    this.loader?.disconnect();
    if (this.rendered >= this.items.length) return;
    this.loader = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) this.renderCount(this.batchSize, true);
      },
      { root: this.horizontal ? this.grid : null, rootMargin: '100%' },
    );
    const tail = this.grid.lastElementChild;
    if (tail) this.loader.observe(tail);
  }

  private renderCount(count: number, announce: boolean): void {
    const start = this.rendered;
    const batch = this.items.slice(start, start + count);
    if (batch.length === 0) return;
    const fragment = document.createDocumentFragment();
    batch.forEach((item, offset) => {
      fragment.append(this.renderItem(item, start + offset));
    });
    this.grid.append(fragment);
    this.rendered += batch.length;
    if (announce) this.announce(batch);
    this.observeTail();
  }

  private renderItem(item: WallItem, index: number): HTMLLIElement {
    switch (item.type) {
      case 'era':
        return el('li', { class: 'wall__item', 'data-size': 'sm', 'data-type': 'era' }, [
          renderEra(item.era),
        ]);
      case 'end-cap':
        return el('li', { class: 'wall__item', 'data-size': 'tall', 'data-type': 'end-cap' }, [
          renderEndCap(),
        ]);
      case 'project': {
        const card = new ProjectCard();
        card.project = item.project;
        card.eager = index < EAGER_ITEMS;
        return el(
          'li',
          { class: 'wall__item', 'data-size': item.project.size, 'data-type': 'project' },
          [card],
        );
      }
    }
  }

  private announce(batch: readonly WallItem[]): void {
    if (!this.status) return;
    const years = batch.flatMap((item) =>
      item.type === 'project' ? [Number(item.project.period.start.slice(0, 4))] : [],
    );
    if (years.length === 0) return;
    const range = `${Math.max(...years)}–${Math.min(...years)}`;
    this.status.textContent = `Loaded ${years.length} more projects (${range}).`;
  }

  private readonly onClick = (event: MouseEvent): void => {
    const link = event.target instanceof Element ? event.target.closest('a.card__link') : null;
    if (!(link instanceof HTMLAnchorElement) || !link.dataset['slug']) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent('timeline:open', { detail: { slug: link.dataset['slug'] }, bubbles: true }),
    );
  };

  private readonly onIntent = (event: Event): void => {
    if (this.intentSent || !(event.target instanceof Element) || !event.target.closest('.card'))
      return;
    this.intentSent = true;
    this.dispatchEvent(new CustomEvent('timeline:intent', { detail: null, bubbles: true }));
  };

  private readonly onKeydown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLAnchorElement) || !target.classList.contains('card__link')) return;
    if (!isNavKey(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'End') this.renderAll();
    const links = [...this.grid.querySelectorAll<HTMLAnchorElement>('a.card__link')];
    const boxes = links.map((link) => {
      const card = link.closest('.card') ?? link;
      return card.getBoundingClientRect();
    });
    const next = nextIndex(event.key, links.indexOf(target), boxes);
    const destination = links[next];
    if (!destination) return;
    event.preventDefault();
    destination.focus();
  };
}

export function define(): void {
  defineOnce('timeline-wall', TimelineWall);
}
