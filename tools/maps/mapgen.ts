/**
 * Shared helpers for the map generator scripts (PLAN §8.3, docs/plans/m7-menus-art-maps.md §6).
 *
 * Every map is designed for the human player's half only (bottom-right on screen, x + y > W - 1)
 * and then rotated 180° into the machine player's half, so the maps are fair by construction.
 * The output is a normal, hand-editable map file.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  decodeMap,
  type MapFileInput,
  type MapObjectName,
  type MapScenario,
  type TerrainType,
} from '../../src/shared';
import { GAME_DATA, validateMap } from '../../src/engine';

export const TERRAIN_CHAR: Record<TerrainType, string> = {
  grass: '.',
  dirt: ',',
  sand: ':',
  shallow: '~',
  water: 'W',
  rock: '#',
};
export const OBJECT_CHAR: Record<MapObjectName, string> = {
  tree: 'T',
  pine: 'P',
  gold_mine: 'G',
  berry_bush: 'B',
  stone: 'r',
  spawn_p1: '1',
  spawn_p2: '2',
};
export const FOOTPRINT: Partial<Record<MapObjectName, number>> = { gold_mine: 2, spawn_p1: 3, spawn_p2: 3 };

const LAND: ReadonlySet<TerrainType> = new Set(['grass', 'dirt', 'sand']);

export function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1). */
export function noise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

export interface PlacedObject {
  name: MapObjectName;
  x: number;
  y: number;
}

/** Terrain, objects and "keep free" tiles of one map while it is being generated. */
export class MapCanvas {
  readonly terrain: TerrainType[];
  readonly objects: PlacedObject[] = [];
  /** Tiles that must stay free of generated trees/stones (footprints plus breathing room). */
  readonly reserved: Uint8Array;

  constructor(
    readonly W: number,
    readonly H: number,
  ) {
    this.terrain = new Array<TerrainType>(W * H).fill('grass');
    this.reserved = new Uint8Array(W * H);
  }

  idx(x: number, y: number): number {
    return y * this.W + x;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.W && y < this.H;
  }

  /** The human player's half (bottom-right on screen). Its 180° mirror is the machine's half. */
  inPrimaryHalf(x: number, y: number): boolean {
    const { W } = this;
    return x + y > W - 1 || (x + y === W - 1 && x >= W / 2);
  }

  /**
   * Signed distance of a tile center from the diagonal between the halves (positive on the human
   * player's side) and the position along it (0 = map center). Both in tiles.
   */
  diagonal(x: number, y: number): { d: number; t: number } {
    const cx = x + 0.5;
    const cy = y + 0.5;
    return { d: (cx + cy - this.W) / Math.SQRT2, t: (cx - cy) / Math.SQRT2 };
  }

  reserve(x: number, y: number, w: number, h: number, margin: number): void {
    for (let j = y - margin; j < y + h + margin; j++)
      for (let i = x - margin; i < x + w + margin; i++)
        if (this.inside(i, j)) this.reserved[this.idx(i, j)] = 1;
  }

  place(name: MapObjectName, x: number, y: number, margin = 1): void {
    const size = FOOTPRINT[name] ?? 1;
    this.objects.push({ name, x, y });
    this.reserve(x, y, size, size, margin);
  }

  /** Every footprint tile is land, not reserved and inside the primary half. */
  canPlace(name: MapObjectName, x: number, y: number): boolean {
    const size = FOOTPRINT[name] ?? 1;
    for (let j = y; j < y + size; j++)
      for (let i = x; i < x + size; i++) {
        if (!this.inside(i, j) || !this.inPrimaryHalf(i, j) || this.reserved[this.idx(i, j)]) return false;
        if (!LAND.has(this.terrain[this.idx(i, j)] ?? 'water')) return false;
      }
    return true;
  }

  /** Place at the free spot nearest to (x, y) within `radius`; throws if there is none. */
  placeNear(name: MapObjectName, x: number, y: number, margin = 1, radius = 6): { x: number; y: number } {
    for (let r = 0; r <= radius; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!this.canPlace(name, x + dx, y + dy)) continue;
          this.place(name, x + dx, y + dy, margin);
          return { x: x + dx, y: y + dy };
        }
    throw new Error(`no room for ${name} near ${x},${y}`);
  }

  /** Copy the primary half onto the other half, rotated 180°. Returns the mirrored objects. */
  mirror(): void {
    const { W, H } = this;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (!this.inPrimaryHalf(x, y))
          this.terrain[this.idx(x, y)] = this.terrain[this.idx(W - 1 - x, H - 1 - y)] ?? 'grass';
    const mirrored = this.objects.map((o) => {
      const size = FOOTPRINT[o.name] ?? 1;
      const name: MapObjectName = o.name === 'spawn_p1' ? 'spawn_p2' : o.name;
      return { name, x: W - o.x - size, y: H - o.y - size };
    });
    this.objects.push(...mirrored);
  }

  terrainRows(): string[] {
    return Array.from({ length: this.H }, (_, y) =>
      Array.from({ length: this.W }, (_, x) => TERRAIN_CHAR[this.terrain[this.idx(x, y)] ?? 'grass']).join(
        '',
      ),
    );
  }

  objectRows(): string[] {
    const grid = Array.from({ length: this.H }, () => new Array<string>(this.W).fill('.'));
    for (const o of this.objects) {
      const row = grid[o.y];
      if (!row) throw new Error(`object outside map at ${o.x},${o.y}`);
      row[o.x] = OBJECT_CHAR[o.name];
    }
    return grid.map((row) => row.join(''));
  }
}

export function legend(): MapFileInput['legend'] {
  return {
    terrain: Object.fromEntries(Object.entries(TERRAIN_CHAR).map(([t, c]) => [c, t])) as Record<
      string,
      TerrainType
    >,
    objects: Object.fromEntries(Object.entries(OBJECT_CHAR).map(([o, c]) => [c, o])) as Record<
      string,
      MapObjectName
    >,
  };
}

type ScenarioPlayer = MapScenario['players'][number];
type ScenarioBuilding = ScenarioPlayer['buildings'][number];
type ScenarioUnits = ScenarioPlayer['units'][number];

/**
 * Finds free spots for the human player's scenario buildings near the wanted tiles (land, no
 * object, a 1-tile ring kept free) and mirrors them for the machine player. Call after every
 * object of the human player's half is placed and before mirror().
 */
export function placeScenarioBuildings(
  canvas: MapCanvas,
  wanted: Array<{ type: string; near: [number, number] }>,
): { human: ScenarioBuilding[]; machine: ScenarioBuilding[] } {
  const occupied = new Uint8Array(canvas.W * canvas.H);
  for (const o of canvas.objects) {
    const size = FOOTPRINT[o.name] ?? 1;
    for (let j = o.y; j < o.y + size; j++)
      for (let i = o.x; i < o.x + size; i++) if (canvas.inside(i, j)) occupied[canvas.idx(i, j)] = 1;
  }
  const fits = (x: number, y: number, w: number, h: number): boolean => {
    for (let j = y - 1; j < y + h + 1; j++)
      for (let i = x - 1; i < x + w + 1; i++) {
        if (!canvas.inside(i, j) || !canvas.inPrimaryHalf(i, j) || occupied[canvas.idx(i, j)]) return false;
        if (!LAND.has(canvas.terrain[canvas.idx(i, j)] ?? 'water')) return false;
      }
    return true;
  };
  const human: ScenarioBuilding[] = [];
  const machine: ScenarioBuilding[] = [];
  for (const { type, near } of wanted) {
    const def = GAME_DATA.buildings[type];
    if (!def) throw new Error(`unknown building ${type}`);
    const [w, h] = def.footprint;
    let spot: [number, number] | null = null;
    for (let r = 0; r <= 8 && !spot; r++)
      for (let dy = -r; dy <= r && !spot; dy++)
        for (let dx = -r; dx <= r && !spot; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (fits(near[0] + dx, near[1] + dy, w, h)) spot = [near[0] + dx, near[1] + dy];
        }
    if (!spot) throw new Error(`no room for scenario ${type} near ${near.join(',')}`);
    for (let j = spot[1]; j < spot[1] + h; j++)
      for (let i = spot[0]; i < spot[0] + w; i++) occupied[canvas.idx(i, j)] = 1;
    human.push({ type, at: spot, constructed: true });
    machine.push({ type, at: [canvas.W - spot[0] - w, canvas.H - spot[1] - h], constructed: true });
  }
  return { human, machine };
}

/** The machine player's copy of a unit group (rotated 180°). */
export function mirrorUnits(canvas: MapCanvas, units: ScenarioUnits[]): ScenarioUnits[] {
  return units.map((u) => ({ ...u, at: [canvas.W - 1 - u.at[0], canvas.H - 1 - u.at[1]] }));
}

/** Validate the map, print the per-spawn summary, and write maps/<id>.json (exit 1 on errors). */
export function writeMap(file: MapFileInput): void {
  const decoded = decodeMap(file);
  const result = validateMap(decoded);
  console.log(`${file.id}:`);
  for (const s of result.summary) {
    console.log(
      `  player ${s.player + 1}: gold≤8=${s.goldMinesWithin8} berries≤8=${s.berriesWithin8} trees≤12=${s.treesWithin12} gold≤20=${s.goldMinesWithin20} totals=${JSON.stringify(s.totals)}`,
    );
  }
  result.warnings.forEach((w) => console.warn(`  warning: ${w}`));
  if (result.errors.length > 0) {
    result.errors.forEach((e) => console.error(`  error: ${e}`));
    process.exit(1);
  }
  const out = fileURLToPath(new URL(`../../maps/${file.id}.json`, import.meta.url));
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`  wrote ${out} (${decoded.objects.length} objects)`);
}
