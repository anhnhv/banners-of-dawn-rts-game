/**
 * Decoded map: the character grids turned into plain arrays and an object list.
 * Shared by the engine (simulation grid), the UI (rendering) and tools (generator, validator CLI).
 * Coordinates are grid space: x to the right, y "down" (the renderer maps y to world z).
 */
import type { PlayerId } from './ids';
import {
  MapFileSchema,
  type MapFile,
  type MapObjectName,
  type MapScenario,
  type TerrainType,
} from './mapSchema';

export type MapObjectKind = 'tree' | 'pine' | 'gold_mine' | 'berry_bush' | 'stone' | 'spawn';

export interface MapObject {
  kind: MapObjectKind;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Only for spawns: 0 = human player, 1 = machine player. */
  player?: PlayerId;
  /** Resource amount override from the map file, if any. */
  amount?: number;
}

export interface DecodedMap {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  symmetry: MapFile['symmetry'];
  /** Row-major: terrain[y * width + x]. */
  terrain: TerrainType[];
  objects: MapObject[];
  startUnits: Array<[string, number]>;
  /** Ready-made start from the map file, if it has one (used when the game options ask for it). */
  scenario: MapScenario | null;
}

/** Footprint (w, h) of each object kind. A spawn marks the Town Hall (3×3). */
export const OBJECT_FOOTPRINT: Record<MapObjectKind, [number, number]> = {
  tree: [1, 1],
  pine: [1, 1],
  gold_mine: [2, 2],
  berry_bush: [1, 1],
  stone: [1, 1],
  spawn: [3, 3],
};

/** Objects that are resources (they block tiles and can be gathered). */
export const RESOURCE_KINDS: ReadonlySet<MapObjectKind> = new Set([
  'tree',
  'pine',
  'gold_mine',
  'berry_bush',
]);

export class MapFormatError extends Error {
  constructor(
    message: string,
    readonly issues: string[],
  ) {
    super(`${message}:\n  - ${issues.join('\n  - ')}`);
    this.name = 'MapFormatError';
  }
}

/** Parse + decode a map file. Throws MapFormatError listing every problem found. */
export function decodeMap(raw: unknown): DecodedMap {
  const parsed = MapFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new MapFormatError(
      'Invalid map file',
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  const file = parsed.data;
  const { w, h } = file.size;
  const issues: string[] = [];

  checkGrid('terrain', file.terrain, w, h, issues);
  checkGrid('objects', file.objects, w, h, issues);

  const terrain: TerrainType[] = new Array<TerrainType>(w * h).fill('grass');
  for (let y = 0; y < Math.min(h, file.terrain.length); y++) {
    const row = file.terrain[y] ?? '';
    for (let x = 0; x < Math.min(w, row.length); x++) {
      const ch = row[x] ?? '';
      const type = file.legend.terrain[ch];
      if (type) terrain[y * w + x] = type;
      else issues.push(`terrain[${y}][${x}]: character "${ch}" is not in legend.terrain`);
    }
  }

  const objects: MapObject[] = [];
  for (let y = 0; y < Math.min(h, file.objects.length); y++) {
    const row = file.objects[y] ?? '';
    for (let x = 0; x < Math.min(w, row.length); x++) {
      const ch = row[x] ?? ' ';
      if (ch === ' ' || ch === '.') continue;
      const name = file.legend.objects[ch];
      if (!name) {
        issues.push(`objects[${y}][${x}]: character "${ch}" is not in legend.objects`);
        continue;
      }
      objects.push(makeObject(name, x, y));
    }
  }

  for (const o of file.overrides) {
    const target = objects.find((obj) => obj.x === o.at[0] && obj.y === o.at[1]);
    if (!target) issues.push(`overrides: no object at ${o.at[0]},${o.at[1]}`);
    else if (!RESOURCE_KINDS.has(target.kind))
      issues.push(`overrides: object at ${o.at[0]},${o.at[1]} is not a resource`);
    else target.amount = o.amount;
  }

  if (issues.length > 0) throw new MapFormatError(`Map "${file.id}" has format errors`, issues);

  return {
    id: file.id,
    name: file.name,
    description: file.description,
    width: w,
    height: h,
    symmetry: file.symmetry,
    terrain,
    objects,
    startUnits: file.start.units,
    scenario: file.scenario ?? null,
  };
}

function makeObject(name: MapObjectName, x: number, y: number): MapObject {
  if (name === 'spawn_p1' || name === 'spawn_p2') {
    const [w, h] = OBJECT_FOOTPRINT.spawn;
    return { kind: 'spawn', x, y, w, h, player: name === 'spawn_p1' ? 0 : 1 };
  }
  const [w, h] = OBJECT_FOOTPRINT[name];
  return { kind: name, x, y, w, h };
}

function checkGrid(name: string, rows: string[], w: number, h: number, issues: string[]): void {
  if (rows.length !== h) issues.push(`${name}: expected ${h} rows, found ${rows.length}`);
  rows.forEach((row, y) => {
    if (row.length !== w) issues.push(`${name}[${y}]: expected ${w} characters, found ${row.length}`);
  });
}

export function terrainAt(map: DecodedMap, x: number, y: number): TerrainType | null {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  return map.terrain[y * map.width + x] ?? null;
}

/** Center of an object's footprint, in tile units. */
export function objectCenter(o: MapObject): { x: number; y: number } {
  return { x: o.x + o.w / 2, y: o.y + o.h / 2 };
}
