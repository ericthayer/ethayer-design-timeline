import { describe, expect, it } from 'vitest';
import { ERAS } from '../../src/content/eras.ts';
import { PROJECTS } from '../../src/content/projects/index.ts';
import { hashSeed, indexNumerals, pad2, periodText, yearRange } from '../../src/core/format.ts';
import { buildWallItems, itemIndexOf, projectSequence } from '../../src/core/order.ts';
import { cascade, toPoints } from '../../src/core/cascade.ts';
import {
  isResumePath,
  parseSlug,
  Router,
  routerBase,
  type RouterHandlers,
} from '../../src/core/router.ts';
import { nextIndex, type Box } from '../../src/core/spatial-nav.ts';
import { normalizeWheelDelta, shouldRemap, wallOwnsWheel } from '../../src/core/wheel.ts';

describe('format', () => {
  it('builds poster numerals and spoken periods', () => {
    expect(indexNumerals({ start: '2023-12', end: 'present' })).toEqual(['23_', '→']);
    expect(indexNumerals({ start: '2017-12', end: '2023-07' })).toEqual(['17_', '23']);
    expect(periodText({ start: '2023-12', end: 'present' })).toBe('2023 to present');
    expect(periodText({ start: '2021-01', end: '2021-12' })).toBe('2021');
    expect(yearRange({ start: '2017-12', end: '2023-07' })).toBe('2017–2023');
    expect(pad2(3)).toBe('03');
  });

  it('hashes seeds deterministically', () => {
    expect(hashSeed('dmns')).toBe(hashSeed('dmns'));
    expect(hashSeed('dmns')).not.toBe(hashSeed('sublist'));
  });
});

describe('order', () => {
  const items = buildWallItems(PROJECTS, ERAS);

  it('opens with the first era marker and closes with the end-cap (spec 002 FR-008)', () => {
    expect(items[0]?.type).toBe('era');
    expect(items.some((item) => (item.type as string) === 'identity')).toBe(false);
    expect(items.at(-1)?.type).toBe('end-cap');
  });

  it('places one Education tile at the end of the first era (FR-074)', () => {
    const at = items.findIndex((item) => item.type === 'education');
    expect(items.filter((item) => item.type === 'education')).toHaveLength(1);
    expect(items[at - 1]?.type).toBe('project');
    expect(items.slice(1, at).every((item) => item.type === 'project')).toBe(true);
    expect(items[at + 1]?.type).toBe('era');
  });

  it('starts each era with its marker and numbers projects 1…N', () => {
    const sequence = projectSequence(items);
    expect(sequence).toHaveLength(PROJECTS.length);
    let currentEra = '';
    let expected = 1;
    for (const item of items) {
      if (item.type === 'era') currentEra = item.era.id;
      if (item.type === 'project') {
        expect(item.project.era).toBe(currentEra);
        expect(item.index).toBe(expected);
        expect(item.total).toBe(PROJECTS.length);
        expected += 1;
      }
    }
  });

  it('finds item positions by slug', () => {
    expect(itemIndexOf(items, 'agentic-engineering-loop')).toBe(1);
    expect(itemIndexOf(items, 'missing')).toBe(-1);
  });
});

describe('router', () => {
  it('parses /work/:slug', () => {
    expect(parseSlug('/work/dmns')).toBe('dmns');
    expect(parseSlug('/work/dmns/')).toBe('dmns');
    expect(parseSlug('/')).toBeNull();
    expect(parseSlug('/work/Bad_Slug')).toBeNull();
  });

  it('recognizes /resume (spec 002 FR-124)', () => {
    expect(isResumePath('/resume')).toBe(true);
    expect(isResumePath('/resume/')).toBe(true);
    expect(isResumePath('/resumes')).toBe(false);
    expect(parseSlug('/resume')).toBeNull();
  });
});

describe('router /admin base (spec 004 FR-342)', () => {
  const calls: string[] = [];
  const handlers: RouterHandlers = {
    onOpen: (slug) => calls.push(`open:${slug}`),
    onResume: () => calls.push('resume'),
    onClose: () => calls.push('close'),
  };
  const at = (path: string): void => {
    history.replaceState(null, '', path);
    calls.length = 0;
  };

  it('is /admin only for /admin and /admin/*', () => {
    expect(routerBase('/admin')).toBe('/admin');
    expect(routerBase('/admin/')).toBe('/admin');
    expect(routerBase('/admin/work/dmns')).toBe('/admin');
    expect(routerBase('/administrator')).toBe('');
    expect(routerBase('/work/admin')).toBe('');
    expect(routerBase('/')).toBe('');
  });

  it('syncs admin deep links, including /admin/resume', () => {
    const router = new Router(handlers, '/admin');
    at('/admin/work/dmns');
    router.sync();
    expect(calls).toEqual(['open:dmns']);
    at('/admin/resume');
    router.sync();
    expect(calls).toEqual(['resume']);
    at('/admin/');
    router.sync();
    expect(calls).toEqual(['close']);
  });

  it('keeps the base on open, replace, close, and reset', () => {
    const router = new Router(handlers, '/admin');
    at('/admin');
    router.open('dmns');
    expect(location.pathname).toBe('/admin/work/dmns');
    router.replace('cobank');
    expect(location.pathname).toBe('/admin/work/cobank');
    router.openResume();
    expect(location.pathname).toBe('/admin/resume');
    at('/admin/work/cobank');
    router.close();
    expect(location.pathname).toBe('/admin');
    at('/admin/work/nope');
    router.reset();
    expect(location.pathname).toBe('/admin');
  });

  it('leaves public paths unchanged', () => {
    const router = new Router(handlers, '');
    at('/');
    router.open('dmns');
    expect(location.pathname).toBe('/work/dmns');
    at('/work/dmns');
    router.close();
    expect(location.pathname).toBe('/');
    at('/admin/work/dmns');
    router.sync();
    expect(calls).toEqual(['close']);
  });
});

describe('hero cascade (spec 002 FR-104)', () => {
  const triangles = cascade([78, 0], [8, 100], [148, 100], 5);

  it('emits 1 + 4 × depth triangles, deterministically, within the node cap', () => {
    expect(triangles).toHaveLength(21);
    expect(triangles.length).toBeLessThanOrEqual(80);
    expect(cascade([78, 0], [8, 100], [148, 100], 5)).toEqual(triangles);
  });

  it('shrinks toward the bottom-left corner', () => {
    const bases = triangles.filter((t) => t.facet === 'base');
    for (const base of bases) expect(base.points[1]).toEqual([8, 100]);
    const widths = bases.map((t) => t.points[2][0] - t.points[1][0]);
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
    expect(toPoints(bases[1]?.points ?? [])).toBe('43,50 8,100 78,100');
  });
});

describe('wheel', () => {
  it('normalizes delta modes', () => {
    expect(normalizeWheelDelta({ deltaY: 3, deltaMode: 1 }, 800)).toBe(48);
    expect(normalizeWheelDelta({ deltaY: 1, deltaMode: 2 }, 800)).toBe(800);
    expect(normalizeWheelDelta({ deltaY: 120, deltaMode: 0 }, 800)).toBe(120);
  });

  it('remaps only vertical-dominant, non-zoom wheels', () => {
    const base = { deltaX: 0, deltaY: 100, ctrlKey: false, metaKey: false };
    expect(shouldRemap(base)).toBe(true);
    expect(shouldRemap({ ...base, deltaX: 140 })).toBe(false);
    expect(shouldRemap({ ...base, ctrlKey: true })).toBe(false);
  });

  it('takes the wheel only once the wall is docked, and lets "up" pass at its start', () => {
    expect(wallOwnsWheel(240, 0, 100)).toBe(false);
    expect(wallOwnsWheel(0, 0, 100)).toBe(true);
    expect(wallOwnsWheel(0, 0, -100)).toBe(false);
    expect(wallOwnsWheel(0, 500, -100)).toBe(true);
  });
});

describe('spatial nav', () => {
  // 2 × 2 grid: 0 1 / 2 3
  const boxes: Box[] = [
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 104, y: 0, width: 100, height: 100 },
    { x: 0, y: 104, width: 100, height: 100 },
    { x: 104, y: 104, width: 100, height: 100 },
  ];

  it('moves in DOM order on ←/→ and by geometry on ↑/↓', () => {
    expect(nextIndex('ArrowRight', 0, boxes)).toBe(1);
    expect(nextIndex('ArrowLeft', 0, boxes)).toBe(-1);
    expect(nextIndex('ArrowDown', 1, boxes)).toBe(3);
    expect(nextIndex('ArrowUp', 2, boxes)).toBe(0);
    expect(nextIndex('ArrowDown', 3, boxes)).toBe(-1);
    expect(nextIndex('Home', 3, boxes)).toBe(0);
    expect(nextIndex('End', 0, boxes)).toBe(3);
  });
});
