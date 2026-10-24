import { describe, expect, it } from 'vitest';
import { ERAS } from '../../src/content/eras.ts';
import { PROJECTS } from '../../src/content/projects/index.ts';
import { hashSeed, indexNumerals, pad2, periodText, yearRange } from '../../src/core/format.ts';
import { buildWallItems, itemIndexOf, projectSequence } from '../../src/core/order.ts';
import { parseSlug } from '../../src/core/router.ts';
import { nextIndex, type Box } from '../../src/core/spatial-nav.ts';
import { normalizeWheelDelta, shouldRemap } from '../../src/core/wheel.ts';

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

  it('opens with the identity poster and closes with the end-cap', () => {
    expect(items[0]?.type).toBe('identity');
    expect(items.at(-1)?.type).toBe('end-cap');
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
    expect(itemIndexOf(items, 'agentic-engineering-loop')).toBe(2);
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
