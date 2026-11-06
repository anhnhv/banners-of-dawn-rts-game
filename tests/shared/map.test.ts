import { describe, expect, it } from 'vitest';
import { decodeMap, MapFormatError, type MapFileInput } from '../../src/shared';

function tinyMap(overrides: Partial<MapFileInput> = {}): MapFileInput {
  const W = 16;
  const row = '.'.repeat(W);
  const terrain = Array.from({ length: 16 }, () => row);
  terrain[8] = 'WW' + '.'.repeat(W - 2);
  const objects = Array.from({ length: 16 }, () => row);
  objects[1] = '.1' + '.'.repeat(W - 2);
  objects[12] = '.'.repeat(12) + '2...';
  objects[5] = '....T.G.........';
  return {
    id: 'tiny',
    name: 'Tiny',
    version: 1,
    size: { w: W, h: 16 },
    players: 2,
    symmetry: 'none',
    legend: {
      terrain: { '.': 'grass', W: 'water' },
      objects: { '1': 'spawn_p1', '2': 'spawn_p2', T: 'tree', G: 'gold_mine' },
    },
    terrain,
    objects,
    overrides: [{ at: [6, 5], amount: 1234 }],
    ...overrides,
  };
}

describe('decodeMap', () => {
  it('decodes terrain and objects with footprints', () => {
    const map = decodeMap(tinyMap());
    expect(map.width).toBe(16);
    expect(map.terrain[8 * 16]).toBe('water');
    expect(map.terrain[0]).toBe('grass');
    const spawn1 = map.objects.find((o) => o.kind === 'spawn' && o.player === 0);
    expect(spawn1).toMatchObject({ x: 1, y: 1, w: 3, h: 3 });
    expect(map.objects.find((o) => o.kind === 'spawn' && o.player === 1)).toMatchObject({ x: 12, y: 12 });
    expect(map.objects.find((o) => o.kind === 'gold_mine')).toMatchObject({
      x: 6,
      y: 5,
      w: 2,
      h: 2,
      amount: 1234,
    });
    expect(map.objects.find((o) => o.kind === 'tree')).toMatchObject({ x: 4, y: 5, w: 1, h: 1 });
  });

  it('rejects files that do not match the schema', () => {
    expect(() => decodeMap({ id: 'Bad Id!' })).toThrow(MapFormatError);
  });

  it('reports wrong row lengths, unknown characters and bad overrides together', () => {
    const bad = tinyMap({ overrides: [{ at: [0, 0], amount: 5 }] });
    bad.terrain[3] = '..x' + '.'.repeat(13);
    bad.objects[4] = '...';
    try {
      decodeMap(bad);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(MapFormatError);
      const issues = (err as MapFormatError).issues.join('\n');
      expect(issues).toContain('"x" is not in legend.terrain');
      expect(issues).toContain('objects[4]: expected 16 characters, found 3');
      expect(issues).toContain('overrides: no object at 0,0');
    }
  });
});
