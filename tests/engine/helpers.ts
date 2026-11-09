import { readFileSync } from 'node:fs';
import type { DecodedMap, MapFile, MapObject, TerrainType } from '../../src/shared';

/** A shipped map file from maps/. */
export function mapFile(id: string): MapFile {
  return JSON.parse(readFileSync(new URL(`../../maps/${id}.json`, import.meta.url), 'utf8')) as MapFile;
}

export const GREEN_VALLEY = mapFile('green_valley');

const CHARS: Record<string, TerrainType> = {
  '.': 'grass',
  '#': 'rock',
  '~': 'shallow',
  W: 'water',
};

/** Build a small DecodedMap from ASCII rows ('.' grass, '#' rock, '~' shallow, 'W' water). No objects. */
export function asciiMap(rows: string[], objects: MapObject[] = []): DecodedMap {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const terrain: TerrainType[] = [];
  for (const row of rows) for (const ch of row) terrain.push(CHARS[ch] ?? 'grass');
  return {
    id: 'test',
    name: 'Test',
    description: '',
    width,
    height,
    symmetry: 'none',
    terrain,
    objects,
    startUnits: [],
    scenario: null,
  };
}

/** An open w×h grass map. */
export function openMap(w: number, h: number, objects: MapObject[] = []): DecodedMap {
  return asciiMap(
    Array.from({ length: h }, () => '.'.repeat(w)),
    objects,
  );
}

/** A 1×1 resource object (tree, pine, berry_bush) or a 2×2 gold mine for test maps. */
export function node(
  kind: 'tree' | 'pine' | 'berry_bush' | 'gold_mine',
  x: number,
  y: number,
  amount?: number,
): MapObject {
  const size = kind === 'gold_mine' ? 2 : 1;
  return { kind, x, y, w: size, h: size, ...(amount !== undefined ? { amount } : {}) };
}
