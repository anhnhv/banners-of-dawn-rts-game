import type { DecodedMap, TerrainType } from '../../src/shared';

const CHARS: Record<string, TerrainType> = {
  '.': 'grass',
  '#': 'rock',
  '~': 'shallow',
  W: 'water',
};

/** Build a small DecodedMap from ASCII rows ('.' grass, '#' rock, '~' shallow, 'W' water). No objects. */
export function asciiMap(rows: string[]): DecodedMap {
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
    objects: [],
    startUnits: [],
  };
}

/** An open w×h grass map. */
export function openMap(w: number, h: number): DecodedMap {
  return asciiMap(Array.from({ length: h }, () => '.'.repeat(w)));
}
