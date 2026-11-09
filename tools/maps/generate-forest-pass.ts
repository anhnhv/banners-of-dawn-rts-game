/**
 * Generates maps/forest_pass.json (PLAN §8.3, docs/plans/m7-menus-art-maps.md §6.2): 96×96.
 * A dense forest belt along the diagonal between the bases, with two passes cut through it (each a
 * little off the center) and a long open road around each end of the belt. Rock outcrops frame the
 * passes. A rich gold mine (1200) sits at the mouth of one pass on each side.
 * Feel: hold the passes, or cut through the wood to open a new path.
 *
 * Only the human player's half is designed; mapgen.ts mirrors it. Re-run: npm run maps:generate
 */
import { Rng, type MapScenario, type TerrainType } from '../../src/shared';
import { dist, legend, MapCanvas, mirrorUnits, noise, placeScenarioBuildings, writeMap } from './mapgen';

const W = 96;
const H = 96;
const rng = new Rng(0xf0e57);
const canvas = new MapCanvas(W, H);
const { terrain, reserved } = canvas;

const HOME = { x: 77, y: 77 }; // Town Hall top-left (3×3)
const HOME_C = { x: HOME.x + 1.5, y: HOME.y + 1.5 };
/** Half thickness of the forest belt and how far along the diagonal it reaches (tiles). */
const BELT_HALF = 7;
const BELT_END = 50;
/** The passes cross the belt at ±PASS along the diagonal; each is 2 × PASS_HALF wide. */
const PASS = 14;
const PASS_HALF = 2.6;
const RICH_GOLD = 1200;

/** Grid tile at (d, t) in diagonal coordinates (see MapCanvas.diagonal). */
function atDiagonal(d: number, t: number): { x: number; y: number } {
  return { x: (W + (d + t) * Math.SQRT2) / 2, y: (H + (d - t) * Math.SQRT2) / 2 };
}

const inPass = (t: number): boolean => Math.abs(Math.abs(t) - PASS) < PASS_HALF;
const beltHalf = (x: number, y: number): number => BELT_HALF - 0.8 + 1.6 * noise(x, y, 4, 13);
const beltEnd = (x: number, y: number): number => BELT_END + 4 * noise(x, y, 5, 17);

/** Outcrops that frame both passes, plus two deep in the belt. */
const ROCKS = [
  ...[PASS - 5.2, PASS + 5.2, -PASS - 5.2, -PASS + 5.2].map((t) => atDiagonal(3, t)),
  atDiagonal(2.5, 33),
  atDiagonal(2.5, -33),
];

// ---- terrain ------------------------------------------------------------------------------------

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!canvas.inPrimaryHalf(x, y)) continue;
    const cx = x + 0.5;
    const cy = y + 0.5;
    const { d, t } = canvas.diagonal(x, y);
    let tile: TerrainType = 'grass';
    if (noise(x, y, 7, 11) > 0.72) tile = 'dirt';
    if (d < beltHalf(x, y) && Math.abs(t) < beltEnd(x, y) && noise(x, y, 3, 19) > 0.45) tile = 'dirt'; // forest floor
    if (inPass(t) && d < BELT_HALF + 2) tile = noise(x, y, 2, 23) > 0.35 ? 'dirt' : 'sand'; // the trodden pass
    const dHome = dist(cx, cy, HOME_C.x, HOME_C.y);
    if (dHome < 5 && noise(x, y, 2.5, 21) > 0.38) tile = 'dirt';
    if (dHome < 2.9) tile = 'sand';
    for (const r of ROCKS) if (dist(cx, cy, r.x, r.y) < 1.3 + noise(x, y, 2, 41) * 1.2) tile = 'rock';
    terrain[canvas.idx(x, y)] = tile;
  }
}

// ---- base and resources -------------------------------------------------------------------------

canvas.place('spawn_p1', HOME.x, HOME.y, 3);
canvas.place('gold_mine', 82, 72, 1);
canvas.place('gold_mine', 68, 83, 1);
const richAt = atDiagonal(BELT_HALF + 3, PASS); // at the mouth of the +PASS pass, on this side
const rich = canvas.placeNear('gold_mine', Math.round(richAt.x - 1), Math.round(richAt.y - 1), 2);
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
    if (d < beltHalf(x, y) && Math.abs(t) < beltEnd(x, y))
      chance = inPass(t) ? 0 : 0.93; // the belt
    else if (dHome >= 7.5 && dHome <= 12.5 && behindHome)
      chance = 0.88; // home wood line
    else if ((x >= 89 || y >= 89) && Math.abs(t) < 36)
      chance = 0.45 + 0.4 * noise(x, y, 4, 51); // edge forests, not on the roads
    else if (noise(x, y, 5, 61) > 0.7 && dHome > 9 && d > 13 && Math.abs(t) < 44) chance = 0.7; // groves
    if (chance > 0 && rng.chance(chance)) canvas.place(noise(x, y, 9, 71) > 0.45 ? 'pine' : 'tree', x, y, 0);
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
  if (dist(x, y, HOME_C.x, HOME_C.y) < 9 || canvas.diagonal(x, y).d < BELT_HALF + 3) continue;
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
 * its side of the forest, well outside the range of its Watch Tower and Town Hall.
 */
const scenario: MapScenario = {
  name: 'Skirmish test',
  description: 'Built-up bases, gathering workers and an army each; the enemy army waits behind the forest.',
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
        { type: 'militia', at: [39, 38], count: 6 },
        { type: 'archer', at: [37, 39], count: 4 },
        { type: 'knight', at: [40, 36], count: 2 },
        { type: 'scout_rider', at: [41, 37], count: 1 },
      ],
    },
  ],
};

writeMap({
  id: 'forest_pass',
  name: 'Forest Pass',
  description:
    'A thick forest belt splits the map. Two passes cut through it, a long open road runs around each end, and a rich gold mine guards one pass on each side. Defend the passes, or cut a new way through the wood.',
  version: 1,
  size: { w: W, h: H },
  players: 2,
  symmetry: 'rotate180',
  legend: legend(),
  terrain: canvas.terrainRows(),
  objects: canvas.objectRows(),
  overrides: [
    { at: [rich.x, rich.y], amount: RICH_GOLD },
    { at: [W - rich.x - 2, H - rich.y - 2], amount: RICH_GOLD },
  ],
  start: {
    units: [
      ['worker', 3],
      ['scout_rider', 1],
    ],
  },
  scenario,
});
