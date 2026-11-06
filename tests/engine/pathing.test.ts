import { describe, expect, it } from 'vitest';
import { Grid } from '../../src/engine';
import { PathFinder } from '../../src/engine/path/astar';
import { assignSlots, formationSlots, nearestPassable } from '../../src/engine/path/groupMove';
import { lineOfSight, smoothPath } from '../../src/engine/path/smoothing';
import { asciiMap } from './helpers';

function gridOf(rows: string[]): Grid {
  const m = asciiMap(rows);
  return new Grid(m.width, m.height, m.terrain);
}

const xy = (grid: Grid, i: number): [number, number] => [i % grid.width, Math.floor(i / grid.width)];

describe('A*', () => {
  it('finds a straight path in the open', () => {
    const grid = gridOf(['..........', '..........', '..........']);
    const r = new PathFinder(grid).find(0, 1, 9, 1);
    expect(r.reachedGoal).toBe(true);
    expect(r.tiles).toHaveLength(10);
  });

  it('goes around a wall and never steps on blocked tiles', () => {
    const rows = ['..........', '....#.....', '....#.....', '....#.....', '..........'];
    const grid = gridOf(rows);
    const r = new PathFinder(grid).find(1, 2, 8, 2);
    expect(r.reachedGoal).toBe(true);
    for (const i of r.tiles) expect(grid.isPassable(...xy(grid, i))).toBe(true);
  });

  it('does not cut corners between two blocked tiles', () => {
    const grid = gridOf(['...', '.#.', '#..']);
    // from (0,1) to (1,2): the direct diagonal would squeeze between (1,1) and (0,2),
    // so A* must take the long way round instead of a 2-tile path.
    const r = new PathFinder(grid).find(0, 1, 1, 2);
    expect(r.reachedGoal).toBe(true);
    expect(r.tiles.length).toBeGreaterThan(2);
    expect(r.tiles).not.toContain(grid.index(1, 1));
  });

  it('returns the path to the closest tile when the goal is unreachable', () => {
    const grid = gridOf(['.....#...', '.....#...', '.....#...']);
    const r = new PathFinder(grid).find(0, 1, 8, 1);
    expect(r.reachedGoal).toBe(false);
    const [ex] = xy(grid, r.tiles[r.tiles.length - 1] ?? 0);
    expect(ex).toBe(4); // right next to the wall
  });

  it('prefers dry land over slow shallow water when the detour is short', () => {
    const grid = gridOf(['.........', '..~~~~~..', '.........']);
    const r = new PathFinder(grid).find(0, 1, 8, 1);
    const throughWater = r.tiles.filter((i) => grid.terrainAt(...xy(grid, i)) === 'shallow').length;
    expect(throughWater).toBe(0);
  });
});

describe('smoothing', () => {
  it('reduces an open-field path to its two ends', () => {
    const grid = gridOf(['..........', '..........', '..........', '..........']);
    const pts = Array.from({ length: 8 }, (_, i) => ({ x: i + 0.5, y: Math.min(3, i * 0.5) + 0.5 }));
    expect(smoothPath(grid, pts)).toHaveLength(2);
  });

  it('keeps line of sight blocked by rock and by squeezing through corners', () => {
    const grid = gridOf(['....', '.#..', '..#.', '....']);
    expect(lineOfSight(grid, { x: 0.5, y: 1.5 }, { x: 3.5, y: 1.5 })).toBe(false);
    expect(lineOfSight(grid, { x: 1.0, y: 3.0 }, { x: 3.0, y: 1.0 })).toBe(false); // corner between (1,2)-(2,1)?
    expect(lineOfSight(grid, { x: 0.5, y: 0.5 }, { x: 3.5, y: 0.5 })).toBe(true);
  });
});

describe('group slots', () => {
  it('gives every unit a distinct passable slot, nearest the target first', () => {
    const grid = gridOf(Array.from({ length: 12 }, () => '............'));
    const slots = formationSlots(grid, { x: 6, y: 6 }, 20, 0.75);
    expect(slots).toHaveLength(20);
    const keys = new Set(slots.map((s) => `${s.x},${s.y}`));
    expect(keys.size).toBe(20);
    for (const s of slots) expect(grid.isPassable(Math.floor(s.x), Math.floor(s.y))).toBe(true);
    expect(slots[0]).toEqual({ x: 6, y: 6 });
  });

  it('moves the target off blocked tiles', () => {
    const grid = gridOf(['.....', '.###.', '.###.', '.###.', '.....']);
    const p = nearestPassable(grid, 2.5, 2.5);
    expect(p).not.toBeNull();
    expect(grid.isPassable(Math.floor(p!.x), Math.floor(p!.y))).toBe(true);
  });

  it('assigns each unit a different slot', () => {
    const units = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    const slots = [
      { x: 10, y: 10 },
      { x: 11, y: 10 },
      { x: 12, y: 10 },
    ];
    const a = assignSlots(units, slots, { x: 11, y: 10 });
    expect(new Set(a).size).toBe(3);
  });
});
