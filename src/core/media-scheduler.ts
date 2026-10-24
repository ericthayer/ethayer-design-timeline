/**
 * Media scheduler (FR-034, plan §7): mounts live iframes and plays videos only after a card has
 * been ≥ 50 % visible for a dwell period, within a per-kind budget, evicting the least recently
 * seen. Gates (motion paused, save-data, dialog open, narrow container) deny all live media.
 */
export type MediaKind = 'iframe' | 'video';
export type Gate = 'motion' | 'save-data' | 'dialog' | 'narrow';

export interface MediaLease {
  readonly kind: MediaKind;
  mount(): void;
  unmount(): void;
}

interface Entry {
  readonly lease: MediaLease;
  visible: boolean;
  active: boolean;
  lastSeen: number;
  timer: ReturnType<typeof setTimeout> | undefined;
}

type ObserverFactory = (
  callback: IntersectionObserverCallback,
  init: IntersectionObserverInit,
) => IntersectionObserver;

export interface SchedulerOptions {
  readonly budget?: Readonly<Record<MediaKind, number>>;
  readonly dwellMs?: number;
  readonly now?: () => number;
  readonly createObserver?: ObserverFactory;
}

export class MediaScheduler {
  private readonly entries = new Map<Element, Entry>();
  private readonly gates = new Set<Gate>();
  private readonly budget: Readonly<Record<MediaKind, number>>;
  private readonly dwellMs: number;
  private readonly now: () => number;
  private readonly createObserver: ObserverFactory;
  private viewObserver: IntersectionObserver;
  private nearObserver: IntersectionObserver;

  constructor(options: SchedulerOptions = {}) {
    this.budget = options.budget ?? { iframe: 3, video: 3 };
    this.dwellMs = options.dwellMs ?? 300;
    this.now = options.now ?? (() => performance.now());
    this.createObserver =
      options.createObserver ?? ((callback, init) => new IntersectionObserver(callback, init));
    [this.viewObserver, this.nearObserver] = this.observe(null);
  }

  /** Horizontal mode observes against the wall scroller; vertical mode against the viewport. */
  setRoot(root: Element | null): void {
    this.viewObserver.disconnect();
    this.nearObserver.disconnect();
    [this.viewObserver, this.nearObserver] = this.observe(root);
    for (const target of this.entries.keys()) {
      this.viewObserver.observe(target);
      this.nearObserver.observe(target);
    }
  }

  register(target: Element, lease: MediaLease): () => void {
    this.entries.set(target, {
      lease,
      visible: false,
      active: false,
      lastSeen: 0,
      timer: undefined,
    });
    this.viewObserver.observe(target);
    this.nearObserver.observe(target);
    return () => {
      const entry = this.entries.get(target);
      if (entry) this.deactivate(entry);
      this.viewObserver.unobserve(target);
      this.nearObserver.unobserve(target);
      this.entries.delete(target);
    };
  }

  setGate(gate: Gate, on: boolean): void {
    if (on) this.gates.add(gate);
    else this.gates.delete(gate);
    for (const entry of this.entries.values()) {
      if (this.denied(entry.lease.kind)) this.deactivate(entry);
      else if (entry.visible) this.activate(entry);
    }
  }

  activeCount(kind: MediaKind): number {
    return [...this.entries.values()].filter((e) => e.active && e.lease.kind === kind).length;
  }

  private observe(root: Element | null): [IntersectionObserver, IntersectionObserver] {
    const view = this.createObserver(
      (records) => {
        this.onView(records);
      },
      { root, threshold: [0, 0.5] },
    );
    const near = this.createObserver(
      (records) => {
        this.onNear(records);
      },
      { root, rootMargin: '100%' },
    );
    return [view, near];
  }

  private onView(records: readonly IntersectionObserverEntry[]): void {
    for (const record of records) {
      const entry = this.entries.get(record.target);
      if (!entry) continue;
      entry.visible = record.isIntersecting && record.intersectionRatio >= 0.5;
      clearTimeout(entry.timer);
      entry.timer = undefined;
      if (entry.visible) {
        entry.lastSeen = this.now();
        entry.timer = setTimeout(() => {
          if (entry.visible) this.activate(entry);
        }, this.dwellMs);
      } else if (entry.lease.kind === 'video') {
        this.deactivate(entry); // videos pause as soon as they leave view
      }
    }
  }

  private onNear(records: readonly IntersectionObserverEntry[]): void {
    for (const record of records) {
      const entry = this.entries.get(record.target);
      if (entry && !record.isIntersecting) this.deactivate(entry);
    }
  }

  private denied(kind: MediaKind): boolean {
    if (this.gates.has('motion') || this.gates.has('dialog') || this.gates.has('save-data')) {
      return true;
    }
    return kind === 'iframe' && this.gates.has('narrow');
  }

  private activate(entry: Entry): void {
    const { kind } = entry.lease;
    if (entry.active || this.denied(kind)) return;
    if (this.activeCount(kind) >= this.budget[kind]) {
      const victim = [...this.entries.values()]
        .filter((e) => e.active && e.lease.kind === kind)
        .sort((a, b) => a.lastSeen - b.lastSeen)[0];
      if (victim) this.deactivate(victim);
    }
    entry.lease.mount();
    entry.active = true;
  }

  private deactivate(entry: Entry): void {
    clearTimeout(entry.timer);
    entry.timer = undefined;
    if (!entry.active) return;
    entry.lease.unmount();
    entry.active = false;
  }
}

let instance: MediaScheduler | undefined;

export function getScheduler(): MediaScheduler {
  instance ??= new MediaScheduler();
  return instance;
}
