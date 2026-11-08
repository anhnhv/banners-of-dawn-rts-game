/**
 * Generates maps/green_valley.json (PLAN §8.3): an open 80×80 grassland, the beginner map.
 *
 * Only the human player's half is designed; the other half is a 180° rotation, so the map is fair
 * by construction. The output is a normal, hand-editable map file. Re-run after changing this script:
 *   npx tsx tools/maps/generate-green-valley.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodeMap, Rng, type MapFileInput, type MapObjectName, type TerrainType } from '../../src/shared';
import { validateMap } from '../../src/engine';

const W = 80;
const H = 80;
const rng = new Rng(0x6ee41a);

const TERRAIN_CHAR: Record<TerrainType, string> = {
  grass: '.',
  dirt: ',',
  sand: ':',
  shallow: '~',
  water: 'W',
  rock: '#',
};
const OBJECT_CHAR: Record<MapObjectName, string> = {
  tree: 'T',
  pine: 'P',
  gold_mine: 'G',
  berry_bush: 'B',
  stone: 'r',
  spawn_p1: '1',
  spawn_p2: '2',
};
const FOOTPRINT: Partial<Record<MapObjectName, number>> = { gold_mine: 2, spawn_p1: 3, spawn_p2: 3 };

// ---- helpers ---------------------------------------------------------------------------------------

/** The human player's half (bottom-right on screen). Its 180° mirror is the machine player's half. */
const inPrimaryHalf = (x: number, y: number): boolean => x + y > W - 1 || (x + y === W - 1 && x >= W / 2);
const idx = (x: number, y: number): number => y * W + x;
const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1). */
function noise(x: number, y: number, scale: number, seed: number): number {
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

// ---- layout (human player's half) ----------------------------------------------------------------

const HOME = { x: 58, y: 58 }; // Town Hall top-left (3×3)
const HOME_C = { x: HOME.x + 1.5, y: HOME.y + 1.5 };
const POND = { x: 49.5, y: 46.5 };
const ROCKS = { x: 69.5, y: 45.5 };
const CENTER = { x: 40, y: 40 };

const terrain: TerrainType[] = new Array<TerrainType>(W * H).fill('grass');
const objects: Array<{ name: MapObjectName; x: number; y: number }> = [];
/** Tiles that must stay free of generated trees/stones (footprints plus breathing room). */
const reserved = new Uint8Array(W * H);

function reserve(x: number, y: number, w: number, h: number, margin: number): void {
  for (let j = y - margin; j < y + h + margin; j++)
    for (let i = x - margin; i < x + w + margin; i++)
      if (i >= 0 && j >= 0 && i < W && j < H) reserved[idx(i, j)] = 1;
}

function place(name: MapObjectName, x: number, y: number, margin = 1): void {
  const size = FOOTPRINT[name] ?? 1;
  objects.push({ name, x, y });
  reserve(x, y, size, size, margin);
}

// Terrain
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!inPrimaryHalf(x, y)) continue;
    const cx = x + 0.5;
    const cy = y + 0.5;
    let t: TerrainType = 'grass';
    if (noise(x, y, 7, 11) > 0.72) t = 'dirt';
    const dHome = dist(cx, cy, HOME_C.x, HOME_C.y);
    if (dHome < 5 && noise(x, y, 2.5, 21) > 0.38) t = 'dirt';
    if (dHome < 2.9) t = 'sand';
    const dPond = dist(cx, cy, POND.x, POND.y);
    if (dPond < 3.5 + noise(x, y, 2, 31) * 0.6) t = 'shallow';
    if (dPond < 2.2) t = 'water';
    if (dist(cx, cy, ROCKS.x, ROCKS.y) < 1.4 + noise(x, y, 2, 41) * 1.4) t = 'rock';
    terrain[idx(x, y)] = t;
  }
}

// Base and its resources
place('spawn_p1', HOME.x, HOME.y, 3);
place('gold_mine', 62, 52, 1);
place('gold_mine', 48, 64, 1);
for (const [x, y] of [
  [53, 57],
  [54, 57],
  [55, 57],
  [53, 58],
  [54, 58],
  [53, 59],
  [54, 60],
] as const)
  place('berry_bush', x, y, 1);
reserve(Math.floor(HOME_C.x - 5.5), Math.floor(HOME_C.y - 5.5), 11, 11, 0); // open space around the Town Hall
reserve(CENTER.x - 4, CENTER.y - 4, 8, 8, 0); // the contested center

// Trees
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!inPrimaryHalf(x, y) || reserved[idx(x, y)]) continue;
    const t = terrain[idx(x, y)];
    if (t !== 'grass' && t !== 'dirt') continue;
    const cx = x + 0.5;
    const cy = y + 0.5;
    const dHome = dist(cx, cy, HOME_C.x, HOME_C.y);
    const behindHome = cx - HOME_C.x + (cy - HOME_C.y) > 1; // toward the map corner, away from the enemy
    let chance = 0;
    if (dHome >= 7.5 && dHome <= 12.5 && behindHome)
      chance = 0.88; // home wood line
    else if (x >= 72 || y >= 72)
      chance = 0.45 + 0.4 * noise(x, y, 4, 51); // edge forests
    else if (noise(x, y, 5, 61) > 0.66 && dHome > 9 && dist(cx, cy, CENTER.x, CENTER.y) > 7) chance = 0.75;
    if (dist(cx, cy, POND.x, POND.y) < 4.5) chance *= 0.3;
    if (chance > 0 && rng.chance(chance)) {
      place(noise(x, y, 9, 71) > 0.55 ? 'pine' : 'tree', x, y, 0);
    }
  }
}

// A few decorative stones in the open
for (let n = 0; n < 9;) {
  const x = rng.int(30, 78);
  const y = rng.int(30, 78);
  if (!inPrimaryHalf(x, y) || reserved[idx(x, y)] || terrain[idx(x, y)] !== 'grass') continue;
  if (dist(x, y, HOME_C.x, HOME_C.y) < 9) continue;
  place('stone', x, y, 1);
  n++;
}

// ---- mirror into the machine player's half -------------------------------------------------------

for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if (!inPrimaryHalf(x, y)) terrain[idx(x, y)] = terrain[idx(W - 1 - x, H - 1 - y)] ?? 'grass';

const mirrored = objects.map((o) => {
  const size = FOOTPRINT[o.name] ?? 1;
  const name: MapObjectName = o.name === 'spawn_p1' ? 'spawn_p2' : o.name;
  return { name, x: W - o.x - size, y: H - o.y - size };
});
objects.push(...mirrored);
objects.push({ name: 'gold_mine', x: CENTER.x - 1, y: CENTER.y - 1 }); // the rich center mine is its own mirror

// ---- encode ----------------------------------------------------------------------------------------

const objectGrid = Array.from({ length: H }, () => new Array<string>(W).fill('.'));
for (const o of objects) {
  const row = objectGrid[o.y];
  if (!row) throw new Error(`object outside map at ${o.x},${o.y}`);
  row[o.x] = OBJECT_CHAR[o.name];
}

/**
 * Ready-made start used by default while testing (PLAN §8.1): both bases already built up with
 * workers gathering; the enemy army waits in the middle of the map, well outside the range of its
 * Town Hall and Watch Tower, so it can be fought without base fire. `?setup=standard` skips it.
 */
const SCENARIO: NonNullable<MapFileInput['scenario']> = {
  name: 'Skirmish test',
  description: 'Built-up bases, gathering workers and an army each; the enemy army waits mid-map.',
  players: [
    {
      player: 1,
      resources: { food: 600, wood: 600, gold: 400 },
      buildings: [
        { type: 'house', at: [64, 57] },
        { type: 'house', at: [56, 62] },
        { type: 'house', at: [59, 63] },
        { type: 'house', at: [57, 65] },
        { type: 'house', at: [52, 61] },
        { type: 'barracks', at: [55, 53] },
        { type: 'stable', at: [62, 62] }, // behind the base, off the attack path
        { type: 'watch_tower', at: [52, 57] },
      ],
      units: [
        { type: 'worker', at: [65, 61], count: 4, gather: 'wood' },
        { type: 'worker', at: [57, 58], count: 3, gather: 'food' },
        { type: 'worker', at: [62, 55], count: 3, gather: 'gold' },
        { type: 'militia', at: [49, 54], count: 6 },
        { type: 'archer', at: [48, 56], count: 4 },
        { type: 'knight', at: [50, 52], count: 2 },
        { type: 'scout_rider', at: [51, 50], count: 2 },
      ],
    },
    {
      player: 2,
      buildings: [
        { type: 'house', at: [15, 17] },
        { type: 'house', at: [22, 16] },
        { type: 'house', at: [18, 23] },
        { type: 'house', at: [14, 23] },
        { type: 'barracks', at: [26, 15] },
        { type: 'stable', at: [18, 13] }, // behind the base, off the attack path
        { type: 'watch_tower', at: [24, 24] },
      ],
      units: [
        { type: 'worker', at: [14, 20], count: 4, gather: 'wood' },
        { type: 'worker', at: [23, 20], count: 3, gather: 'food' },
        { type: 'worker', at: [18, 25], count: 3, gather: 'gold' },
        { type: 'militia', at: [39, 34], count: 6 },
        { type: 'archer', at: [38, 36], count: 4 },
        { type: 'knight', at: [41, 35], count: 2 },
        { type: 'scout_rider', at: [41, 33], count: 1 },
      ],
    },
  ],
};

const file: MapFileInput = {
  id: 'green_valley',
  name: 'Green Valley',
  description:
    'Open grassland with woods behind each base, a pond on each side and a rich gold mine in the middle. A good first map.',
  version: 1,
  size: { w: W, h: H },
  players: 2,
  symmetry: 'rotate180',
  legend: {
    terrain: Object.fromEntries(Object.entries(TERRAIN_CHAR).map(([t, c]) => [c, t])) as Record<
      string,
      TerrainType
    >,
    objects: Object.fromEntries(Object.entries(OBJECT_CHAR).map(([o, c]) => [c, o])) as Record<
      string,
      MapObjectName
    >,
  },
  terrain: Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => TERRAIN_CHAR[terrain[idx(x, y)] ?? 'grass']).join(''),
  ),
  objects: objectGrid.map((row) => row.join('')),
  overrides: [{ at: [CENTER.x - 1, CENTER.y - 1], amount: 1500 }],
  start: {
    units: [
      ['worker', 3],
      ['scout_rider', 1],
    ],
  },
  scenario: SCENARIO,
};

const decoded = decodeMap(file);
const result = validateMap(decoded);
for (const s of result.summary) {
  console.log(
    `player ${s.player + 1}: gold≤8=${s.goldMinesWithin8} berries≤8=${s.berriesWithin8} trees≤12=${s.treesWithin12} gold≤20=${s.goldMinesWithin20} totals=${JSON.stringify(s.totals)}`,
  );
}
result.warnings.forEach((w) => console.warn(`warning: ${w}`));
if (result.errors.length > 0) {
  result.errors.forEach((e) => console.error(`error: ${e}`));
  process.exit(1);
}

const out = fileURLToPath(new URL('../../maps/green_valley.json', import.meta.url));
writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
console.log(`wrote ${out} (${decoded.objects.length} objects)`);
