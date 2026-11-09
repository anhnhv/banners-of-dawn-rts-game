/**
 * Generates maps/green_valley.json (PLAN §8.3): an open 80×80 grassland, the beginner map.
 *
 * Only the human player's half is designed; the other half is a 180° rotation, so the map is fair
 * by construction (helpers in mapgen.ts). Re-run after changing this script: npm run maps:generate
 */
import { Rng, type MapFileInput, type TerrainType } from '../../src/shared';
import { dist, legend, MapCanvas, noise, writeMap } from './mapgen';

const W = 80;
const H = 80;
const rng = new Rng(0x6ee41a);
const canvas = new MapCanvas(W, H);
const { terrain, reserved } = canvas;
const inPrimaryHalf = (x: number, y: number): boolean => canvas.inPrimaryHalf(x, y);
const idx = (x: number, y: number): number => canvas.idx(x, y);
const reserve = canvas.reserve.bind(canvas);
const place = canvas.place.bind(canvas);

// ---- layout (human player's half) ----------------------------------------------------------------

const HOME = { x: 58, y: 58 }; // Town Hall top-left (3×3)
const HOME_C = { x: HOME.x + 1.5, y: HOME.y + 1.5 };
const POND = { x: 49.5, y: 46.5 };
const ROCKS = { x: 69.5, y: 45.5 };
const CENTER = { x: 40, y: 40 };

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

canvas.mirror();
canvas.objects.push({ name: 'gold_mine', x: CENTER.x - 1, y: CENTER.y - 1 }); // the rich center mine is its own mirror

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

writeMap({
  id: 'green_valley',
  name: 'Green Valley',
  description:
    'Open grassland with woods behind each base, a pond on each side and a rich gold mine in the middle. A good first map.',
  version: 1,
  size: { w: W, h: H },
  players: 2,
  symmetry: 'rotate180',
  legend: legend(),
  terrain: canvas.terrainRows(),
  objects: canvas.objectRows(),
  overrides: [{ at: [CENTER.x - 1, CENTER.y - 1], amount: 1500 }],
  start: {
    units: [
      ['worker', 3],
      ['scout_rider', 1],
    ],
  },
  scenario: SCENARIO,
});
