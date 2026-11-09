/**
 * Generates maps/twin_rivers.json (PLAN §8.3, docs/plans/m7-menus-art-maps.md §6.1): 96×96.
 * A river runs along the diagonal between the bases with three shallow fords (a wide one in the
 * middle, a narrow one near each end). Extra gold stands near the outer fords, rock outcrops
 * narrow the way to the middle ford. Feel: chokepoints, towers at fords.
 *
 * Only the human player's half is designed; mapgen.ts mirrors it. Re-run: npm run maps:generate
 */
import { Rng, type MapScenario, type TerrainType } from '../../src/shared';
import { dist, legend, MapCanvas, mirrorUnits, noise, placeScenarioBuildings, writeMap } from './mapgen';

const W = 96;
const H = 96;
const rng = new Rng(0x7a1e55);
const canvas = new MapCanvas(W, H);
const { terrain, reserved } = canvas;

const HOME = { x: 77, y: 77 }; // Town Hall top-left (3×3)
const HOME_C = { x: HOME.x + 1.5, y: HOME.y + 1.5 };
/** Position along the river of the outer fords (the middle ford is at 0). */
const OUTER_FORD = 50;
const MIDDLE_FORD_HALF = 4.5;
const OUTER_FORD_HALF = 1.6;

/** Grid tile at (d, t) in diagonal coordinates (see MapCanvas.diagonal). */
function atDiagonal(d: number, t: number): { x: number; y: number } {
  return { x: (W + (d + t) * Math.SQRT2) / 2, y: (H + (d - t) * Math.SQRT2) / 2 };
}

const riverHalf = (t: number): number => 2.3 + 1.2 * noise(t + 200, 7, 6, 81);
const inFord = (t: number): boolean =>
  Math.abs(t) < MIDDLE_FORD_HALF || Math.abs(Math.abs(t) - OUTER_FORD) < OUTER_FORD_HALF;
const nearFord = (t: number, margin: number): boolean =>
  Math.abs(t) < MIDDLE_FORD_HALF + margin || Math.abs(Math.abs(t) - OUTER_FORD) < OUTER_FORD_HALF + margin;

const ROCKS = [atDiagonal(7.5, 9.5), atDiagonal(7.5, -9.5)]; // flank the approach to the middle ford

// ---- terrain ------------------------------------------------------------------------------------

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!canvas.inPrimaryHalf(x, y)) continue;
    const cx = x + 0.5;
    const cy = y + 0.5;
    const { d, t } = canvas.diagonal(x, y);
    let tile: TerrainType = 'grass';
    if (noise(x, y, 7, 11) > 0.72) tile = 'dirt';
    const dHome = dist(cx, cy, HOME_C.x, HOME_C.y);
    if (dHome < 5 && noise(x, y, 2.5, 21) > 0.38) tile = 'dirt';
    if (dHome < 2.9) tile = 'sand';
    const half = riverHalf(t);
    if (d < half + 2.4 + noise(x, y, 2, 31) * 1.2) tile = 'sand';
    if (d < half + 1.3) tile = 'shallow';
    if (d < half && !inFord(t)) tile = 'water';
    for (const r of ROCKS) if (dist(cx, cy, r.x, r.y) < 1.5 + noise(x, y, 2, 41) * 1.3) tile = 'rock';
    terrain[canvas.idx(x, y)] = tile;
  }
}

// ---- base and resources -------------------------------------------------------------------------

canvas.place('spawn_p1', HOME.x, HOME.y, 3);
canvas.place('gold_mine', 82, 72, 1);
canvas.place('gold_mine', 68, 83, 1);
for (const t of [OUTER_FORD, -OUTER_FORD]) {
  const g = atDiagonal(9.5, t); // extra gold near each outer ford, on this side of the river
  canvas.placeNear('gold_mine', Math.round(g.x - 1), Math.round(g.y - 1), 1);
}
for (const [x, y] of [
  [72, 74],
  [73, 74],
  [74, 73],
  [72, 75],
  [73, 75],
  [71, 76],
  [72, 76],
  [73, 73],
] as const)
  canvas.place('berry_bush', x, y, 1);
canvas.reserve(Math.floor(HOME_C.x - 5.5), Math.floor(HOME_C.y - 5.5), 11, 11, 0); // open space around the Town Hall

// ---- trees ----------------------------------------------------------------------------------------

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!canvas.inPrimaryHalf(x, y) || reserved[canvas.idx(x, y)]) continue;
    const tile = terrain[canvas.idx(x, y)];
    if (tile !== 'grass' && tile !== 'dirt') continue;
    const cx = x + 0.5;
    const cy = y + 0.5;
    const { d, t } = canvas.diagonal(x, y);
    const dHome = dist(cx, cy, HOME_C.x, HOME_C.y);
    const behindHome = cx - HOME_C.x + (cy - HOME_C.y) > 1; // toward the map corner, away from the enemy
    let chance = 0;
    if (dHome >= 7.5 && dHome <= 12.5 && behindHome)
      chance = 0.88; // home wood line
    else if (x >= 89 || y >= 89)
      chance = 0.45 + 0.4 * noise(x, y, 4, 51); // edge forests
    else if (d > 6 && d < 10 && !nearFord(t, 6))
      chance = 0.35 * noise(x, y, 3, 57); // riverside trees
    else if (noise(x, y, 5, 61) > 0.68 && dHome > 9 && d > 12) chance = 0.75; // groves
    if (chance > 0 && rng.chance(chance)) canvas.place(noise(x, y, 9, 71) > 0.5 ? 'pine' : 'tree', x, y, 0);
  }
}

// ---- ready-made scenario (placed before the decor stones so they never take its spots) -----------

const buildings = placeScenarioBuildings(canvas, [
  { type: 'house', near: [83, 76] },
  { type: 'house', near: [76, 83] },
  { type: 'house', near: [85, 79] },
  { type: 'house', near: [73, 81] },
  { type: 'house', near: [80, 73] },
  { type: 'barracks', near: [70, 70] },
  { type: 'stable', near: [85, 68] }, // to the side, off the attack path
  { type: 'watch_tower', near: [74, 71] },
]);
const workers: MapScenario['players'][number]['units'] = [
  { type: 'worker', at: [84, 84], count: 4, gather: 'wood' },
  { type: 'worker', at: [74, 77], count: 3, gather: 'food' },
  { type: 'worker', at: [81, 75], count: 3, gather: 'gold' },
];

// A few decorative stones in the open
for (let n = 0; n < 10;) {
  const x = rng.int(40, 94);
  const y = rng.int(40, 94);
  if (!canvas.inPrimaryHalf(x, y) || reserved[canvas.idx(x, y)] || terrain[canvas.idx(x, y)] !== 'grass')
    continue;
  if (dist(x, y, HOME_C.x, HOME_C.y) < 9 || canvas.diagonal(x, y).d < 8) continue;
  if (
    buildings.human.some((b) => x >= b.at[0] - 1 && x <= b.at[0] + 3 && y >= b.at[1] - 1 && y <= b.at[1] + 3)
  )
    continue;
  canvas.place('stone', x, y, 1);
  n++;
}

canvas.mirror();

/**
 * Ready-made start (PLAN §8.1): built-up bases with workers gathering; the machine's army waits on
 * its side of the middle ford, well outside the range of its Watch Tower and Town Hall.
 */
const scenario: MapScenario = {
  name: 'Skirmish test',
  description: 'Built-up bases, gathering workers and an army each; the enemy army waits at the middle ford.',
  players: [
    {
      player: 1,
      resources: { food: 600, wood: 600, gold: 400 },
      buildings: buildings.human,
      units: [
        ...workers,
        { type: 'militia', at: [67, 67], count: 6 },
        { type: 'archer', at: [66, 69], count: 4 },
        { type: 'knight', at: [69, 65], count: 2 },
        { type: 'scout_rider', at: [70, 63], count: 2 },
      ],
    },
    {
      player: 2,
      resources: {},
      buildings: buildings.machine,
      units: [
        ...mirrorUnits(canvas, workers),
        { type: 'militia', at: [42, 41], count: 6 },
        { type: 'archer', at: [40, 42], count: 4 },
        { type: 'knight', at: [43, 39], count: 2 },
        { type: 'scout_rider', at: [44, 40], count: 1 },
      ],
    },
  ],
};

writeMap({
  id: 'twin_rivers',
  name: 'Twin Rivers',
  description:
    'A river splits the map. Three shallow fords cross it: a wide one in the middle and a narrow one near each end, where extra gold waits. Hold the fords.',
  version: 1,
  size: { w: W, h: H },
  players: 2,
  symmetry: 'rotate180',
  legend: legend(),
  terrain: canvas.terrainRows(),
  objects: canvas.objectRows(),
  overrides: [],
  start: {
    units: [
      ['worker', 3],
      ['scout_rider', 1],
    ],
  },
  scenario,
});
