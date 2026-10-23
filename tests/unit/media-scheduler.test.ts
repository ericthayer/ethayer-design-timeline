import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaScheduler, type MediaKind, type MediaLease } from '../../src/core/media-scheduler.ts';

interface FakeLease {
  readonly value: MediaLease;
  readonly state: { mounted: number; unmounted: number };
}

interface Harness {
  readonly scheduler: MediaScheduler;
  readonly fire: (observer: 0 | 1, target: Element, ratio: number) => void;
  readonly lease: (kind: MediaKind) => FakeLease;
  readonly tick: (ms: number) => number;
}

/** Fake IntersectionObserver pair: index 0 = view (threshold), 1 = near (rootMargin). */
function harness(budget = { iframe: 2, video: 2 }): Harness {
  const callbacks: IntersectionObserverCallback[] = [];
  let clock = 0;
  const scheduler = new MediaScheduler({
    budget,
    dwellMs: 300,
    now: () => clock,
    createObserver: (callback) => {
      callbacks.push(callback);
      return { observe() {}, unobserve() {}, disconnect() {} } as unknown as IntersectionObserver;
    },
  });
  const fire = (observer: 0 | 1, target: Element, ratio: number): void => {
    const callback = callbacks[observer];
    callback?.(
      [
        {
          target,
          isIntersecting: ratio > 0,
          intersectionRatio: ratio,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
  };
  const lease = (kind: MediaKind): FakeLease => {
    const state = { mounted: 0, unmounted: 0 };
    const value: MediaLease = {
      kind,
      mount: () => {
        state.mounted += 1;
      },
      unmount: () => {
        state.unmounted += 1;
      },
    };
    return { value, state };
  };
  return { scheduler, fire, lease, tick: (ms: number) => (clock += ms) };
}

describe('media scheduler (FR-034)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('mounts only after the dwell period at ≥ 50 % visibility', () => {
    const { scheduler, fire, lease } = harness();
    const target = document.createElement('div');
    const { value, state } = lease('iframe');
    scheduler.register(target, value);
    fire(0, target, 0.6);
    vi.advanceTimersByTime(200);
    expect(state.mounted).toBe(0);
    vi.advanceTimersByTime(150);
    expect(state.mounted).toBe(1);
  });

  it('cancels the mount when the card leaves before the dwell ends', () => {
    const { scheduler, fire, lease } = harness();
    const target = document.createElement('div');
    const { value, state } = lease('iframe');
    scheduler.register(target, value);
    fire(0, target, 0.6);
    fire(0, target, 0.2);
    vi.advanceTimersByTime(400);
    expect(state.mounted).toBe(0);
  });

  it('evicts the least recently seen when the budget is full', () => {
    const { scheduler, fire, lease, tick } = harness({ iframe: 2, video: 2 });
    const targets = [0, 1, 2].map(() => document.createElement('div'));
    const [first, second, third] = targets.map(() => lease('iframe'));
    targets.forEach((t, i) => {
      const entry = [first, second, third][i];
      if (!entry) return;
      scheduler.register(t, entry.value);
      tick(10);
      fire(0, t, 1);
      vi.advanceTimersByTime(300);
    });
    expect(scheduler.activeCount('iframe')).toBe(2);
    expect(first?.state.unmounted).toBe(1);
    expect(third?.state.mounted).toBe(1);
  });

  it('pauses videos on leaving view and unmounts iframes only when far away', () => {
    const { scheduler, fire, lease } = harness();
    const video = document.createElement('div');
    const frame = document.createElement('div');
    const v = lease('video');
    const f = lease('iframe');
    scheduler.register(video, v.value);
    scheduler.register(frame, f.value);
    fire(0, video, 1);
    fire(0, frame, 1);
    vi.advanceTimersByTime(300);
    fire(0, video, 0.1);
    fire(0, frame, 0.1);
    expect(v.state.unmounted).toBe(1);
    expect(f.state.unmounted).toBe(0);
    fire(1, frame, 0);
    expect(f.state.unmounted).toBe(1);
  });

  it('denies and releases everything behind a gate', () => {
    const { scheduler, fire, lease } = harness();
    const target = document.createElement('div');
    const { value, state } = lease('video');
    scheduler.register(target, value);
    fire(0, target, 1);
    vi.advanceTimersByTime(300);
    scheduler.setGate('motion', true);
    expect(state.unmounted).toBe(1);
    scheduler.setGate('motion', false);
    expect(state.mounted).toBe(2);
  });

  it('keeps iframes off on narrow containers but still plays video', () => {
    const { scheduler, fire, lease } = harness();
    scheduler.setGate('narrow', true);
    const a = document.createElement('div');
    const b = document.createElement('div');
    const frame = lease('iframe');
    const video = lease('video');
    scheduler.register(a, frame.value);
    scheduler.register(b, video.value);
    fire(0, a, 1);
    fire(0, b, 1);
    vi.advanceTimersByTime(300);
    expect(frame.state.mounted).toBe(0);
    expect(video.state.mounted).toBe(1);
  });
});
