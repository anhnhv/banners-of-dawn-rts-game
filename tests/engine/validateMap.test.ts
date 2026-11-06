import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeMap, type MapFile } from '../../src/shared';
import { loadMap, validateMap } from '../../src/engine';

const GREEN_VALLEY = JSON.parse(
  readFileSync(new URL('../../maps/green_valley.json', import.meta.url), 'utf8'),
) as MapFile;

/** A deep copy of Green Valley with its character grids as editable 2D arrays. */
function editable(): { file: MapFile; terrain: string[][]; objects: string[][]; done: () => MapFile } {
  const file = structuredClone(GREEN_VALLEY);
  const terrain = file.terrain.map((r) => [...r]);
  const objects = file.objects.map((r) => [...r]);
  return {
    file,
    terrain,
    objects,
    done: () => ({
      ...file,
      terrain: terrain.map((r) => r.join('')),
      objects: objects.map((r) => r.join('')),
    }),
  };
}

function errorsOf(file: MapFile): string[] {
  return validateMap(decodeMap(file)).errors;
}

describe('validateMap', () => {
  it('accepts Green Valley with no errors or warnings and equal resources', () => {
    const result = validateMap(decodeMap(GREEN_VALLEY));
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    const [a, b] = result.summary;
    expect(a?.totals).toEqual(b?.totals);
    expect(a?.berriesWithin8).toBeGreaterThanOrEqual(6);
    expect(a?.treesWithin12).toBeGreaterThanOrEqual(40);
  });

  it('detects a broken mirror (terrain)', () => {
    const m = editable();
    const row = m.terrain[10];
    if (row) row[10] = row[10] === '.' ? ',' : '.';
    expect(errorsOf(m.done()).join('\n')).toContain('terrain tile pair(s) do not mirror');
  });

  it('detects missing berries near a base and unfair food', () => {
    const m = editable();
    for (let y = 40; y < 80; y++)
      for (let x = 40; x < 80; x++) if (m.objects[y]?.[x] === 'B') m.objects[y]![x] = '.';
    const errors = errorsOf(m.done()).join('\n');
    expect(errors).toContain('player 1: only 0 berry bushes');
    expect(errors).toContain('unfair food');
    expect(errors).toContain('symmetry');
  });

  it('detects bases that cannot reach each other', () => {
    const m = editable();
    // A river of deep water along the anti-diagonal separates the two halves
    // (it also covers the center gold mine, so drop that mine's amount override).
    m.file.overrides = [];
    for (let y = 0; y < 80; y++) {
      for (let x = 0; x < 80; x++) {
        if (x + y >= 78 && x + y <= 80) {
          m.terrain[y]![x] = 'W';
          m.objects[y]![x] = '.';
        }
      }
    }
    expect(errorsOf(m.done())).toContain('player 2 cannot be reached by land from player 1');
  });

  it('detects a Town Hall placed on unbuildable terrain and objects on water', () => {
    const m = editable();
    const spawn = loadMap(decodeMap(GREEN_VALLEY)).spawns[0]!;
    m.terrain[spawn.y]![spawn.x] = 'W';
    m.terrain[spawn.y + 10]![spawn.x + 10] = 'W';
    m.objects[spawn.y + 10]![spawn.x + 10] = 'T';
    const errors = errorsOf(m.done()).join('\n');
    expect(errors).toContain('Town Hall tile');
    expect(errors).toContain('stands on water');
  });

  it('detects overlapping objects', () => {
    const m = editable();
    const spawn = loadMap(decodeMap(GREEN_VALLEY)).spawns[0]!;
    m.objects[spawn.y + 1]![spawn.x + 1] = 'B'; // inside the Town Hall footprint
    expect(errorsOf(m.done()).join('\n')).toContain('overlaps spawn');
  });
});

describe('loadMap', () => {
  it('blocks the tiles of resources, stones and Town Halls', () => {
    const loaded = loadMap(decodeMap(GREEN_VALLEY));
    const [p1] = loaded.spawns;
    expect(loaded.spawns.map((s) => s.player)).toEqual([0, 1]);
    expect(loaded.grid.isPassable(p1!.x + 1, p1!.y + 1)).toBe(false);
    expect(loaded.grid.isBuildable(p1!.x + 1, p1!.y + 1)).toBe(false);
    const tree = loaded.resources.find((r) => r.kind === 'tree')!;
    expect(tree.amount).toBe(100);
    expect(tree.resource).toBe('wood');
    expect(loaded.grid.isPassable(tree.x, tree.y)).toBe(false);
    const rich = loaded.resources.find((r) => r.kind === 'gold_mine' && r.amount === 1500);
    expect(rich).toBeDefined();
  });

  it('applies terrain rules: shallow is walkable but not buildable, water and rock block', () => {
    const loaded = loadMap(decodeMap(GREEN_VALLEY));
    const { grid } = loaded;
    const find = (type: string): [number, number] | null => {
      for (let y = 0; y < grid.height; y++)
        for (let x = 0; x < grid.width; x++)
          if (grid.terrainAt(x, y) === type && grid.blockers[grid.index(x, y)] === 0) return [x, y];
      return null;
    };
    const shallow = find('shallow');
    const water = find('water');
    const rock = find('rock');
    expect(shallow && grid.isPassable(...shallow)).toBe(true);
    expect(shallow && grid.isBuildable(...shallow)).toBe(false);
    expect(water && grid.isPassable(...water)).toBe(false);
    expect(rock && grid.isPassable(...rock)).toBe(false);
  });
});
