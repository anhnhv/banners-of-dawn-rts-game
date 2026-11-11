/**
 * Aetherfall — a distinct hand-painted low-poly fantasy collection.
 *
 * This collection overrides the Classic geometry using the existing VoxelBuilder API
 * and texture keys. Save this file as collections/aetherfall.ts, beside autumn.ts.
 */
import type { VoxelBuilder } from '../../VoxelBuilder';
import type { ArtCollection, ArtCollectionParts, LegPart, UnitKit } from '../types';

type Color = Parameters<VoxelBuilder['quad']>[1];

type V3 = readonly [number, number, number];
const v = (x: number, y: number, z: number): V3 => [x, y, z];

/**
 * A tapered, four-sided low-poly prism. Unlike box(), the side faces lean
 * inward/outward, which gives walls, armor, trunks and towers a new silhouette.
 */
function taperedPrism(
  b: VoxelBuilder,
  cx: number,
  y: number,
  cz: number,
  bottomW: number,
  bottomD: number,
  topW: number,
  topD: number,
  h: number,
  tex: Parameters<VoxelBuilder['quad']>[0],
  color: Color,
  topColor: Color = color,
): void {
  const y1 = y + h;
  const x0 = cx - bottomW / 2,
    x1 = cx + bottomW / 2;
  const z0 = cz - bottomD / 2,
    z1 = cz + bottomD / 2;
  const tx0 = cx - topW / 2,
    tx1 = cx + topW / 2;
  const tz0 = cz - topD / 2,
    tz1 = cz + topD / 2;

  b.quad(tex, color, v(x0, y, z1), v(x1, y, z1), v(tx1, y1, tz1), v(tx0, y1, tz1));
  b.quad(tex, color, v(x1, y, z0), v(x0, y, z0), v(tx0, y1, tz0), v(tx1, y1, tz0));
  b.quad(tex, color, v(x0, y, z0), v(x0, y, z1), v(tx0, y1, tz1), v(tx0, y1, tz0));
  b.quad(tex, color, v(x1, y, z1), v(x1, y, z0), v(tx1, y1, tz0), v(tx1, y1, tz1));
  b.quad(tex, topColor, v(tx0, y1, tz1), v(tx1, y1, tz1), v(tx1, y1, tz0), v(tx0, y1, tz0));
}

function banner(b: VoxelBuilder, x: number, z: number, y: number, height: number, cloth = 'team'): void {
  b.boxC(x, y + height / 2, z, 0.045, height, 0.045, 'bark', 'wood-dark');
  b.box(x + 0.02, y + height * 0.62, z, 0.34, height * 0.23, 0.035, 'cloth', cloth);
  b.box(x + 0.02, y + height * 0.62 - 0.035, z, 0.34, 0.035, 0.04, 'plain', 'gold');
}

function windowInset(b: VoxelBuilder, x: number, y: number, z: number, width: number, height: number): void {
  b.box(x, y, z, width, height, 0.035, 'plain', 'shadow');
  b.box(x - 0.035, y - 0.035, z + 0.025, width + 0.07, 0.045, 0.045, 'rock', 'stone-light');
  b.box(x - 0.035, y + height - 0.01, z + 0.025, width + 0.07, 0.045, 0.045, 'rock', 'stone-light');
  b.box(x + width / 2 - 0.018, y, z + 0.03, 0.036, height, 0.045, 'planks', 'wood-dark');
}

const colors: NonNullable<ArtCollection['colors']> = {
  plaster: '#d9d7c9',
  stone: '#777f91',
  'stone-dark': '#414b63',
  'stone-light': '#b8c4c9',
  brick: '#a95e58',
  'roof-red': '#a94f5b',
  'roof-slate': '#3d536f',
  wood: '#77503f',
  'wood-dark': '#3f3040',
  'wood-light': '#bd8d62',
  bark: '#4a3540',
  straw: '#c6a35c',
  'straw-light': '#ead08a',
  leaf: '#4f8a72',
  'leaf-light': '#8ebd91',
  'leaf-dark': '#285b57',
  pine: '#245b61',
  dirt: '#8a705f',
  'dirt-dark': '#574c50',
  soil: '#66534f',
  crop: '#6d9b55',
  'crop-ripe': '#d8b64e',
  berry: '#c34f69',
  water: '#4d9ca5',
  gold: '#e8bd62',
  iron: '#b9c5d0',
  'iron-dark': '#586477',
  leather: '#80533f',
  horse: '#9b634b',
  'horse-dark': '#493344',
  skin: '#e2b99a',
  shadow: '#292b40',
  ink: '#202237',
  team: '#3d8792',
  'team-light': '#8bc9c2',
  'team-dark': '#28515f',
  cloth: '#d8c9ad',
};

const iconInk: NonNullable<ArtCollection['iconInk']> = {
  k: '#202237',
  w: '#f7f0df',
  r: '#c34f69',
  R: '#ed8b82',
  d: '#79364f',
  g: '#4f8a72',
  e: '#245b61',
  E: '#8ebd91',
  b: '#77503f',
  B: '#bd8d62',
  n: '#3f3040',
  y: '#e8bd62',
  Y: '#fff0b7',
  o: '#b27c48',
  s: '#e2b99a',
  t: '#3d8792',
  T: '#8bc9c2',
  i: '#dbe2e5',
  I: '#8492a1',
  h: '#c6a35c',
  p: '#a94f5b',
  x: '#62677c',
  X: '#b8c4c9',
  q: '#245b61',
  Q: '#8ebd91',
};

const buildings: ArtCollectionParts['buildings'] = {
  townHall: (b) => {
    taperedPrism(b, 1.5, 0, 1.5, 2.9, 2.9, 2.55, 2.55, 0.28, 'rock', 'stone-dark', 'stone-light');
    taperedPrism(b, 1.5, 0.28, 1.5, 2.45, 2.25, 2.2, 2.0, 1.35, 'bricks', 'plaster');
    for (const x of [0.48, 1.5, 2.52]) {
      taperedPrism(b, x, 0.3, 2.56, 0.15, 0.12, 0.11, 0.1, 1.18, 'rock', 'stone-dark', 'stone-light');
    }
    windowInset(b, 0.68, 0.78, 2.64, 0.35, 0.43);
    windowInset(b, 1.97, 0.78, 2.64, 0.35, 0.43);
    b.box(1.2, 0.28, 2.64, 0.6, 0.82, 0.07, 'planks', 'wood-dark');
    b.gableRoof(0.28, 1.63, 0.36, 2.44, 2.28, 1.28, 'x', 'shingles', 'roof-red', 'plain', 'plaster', 0.2);

    // Tall, narrow central lantern tower: the main silhouette change.
    taperedPrism(b, 1.5, 1.9, 1.5, 1.0, 1.0, 0.72, 0.72, 1.45, 'bricks', 'stone', 'stone-light');
    windowInset(b, 1.36, 2.55, 1.88, 0.28, 0.42);
    b.box(1.0, 3.3, 1.0, 1.0, 0.12, 1.0, 'rock', 'stone-dark');
    b.pyramidRoof(1.02, 3.42, 1.02, 0.96, 0.96, 1.15, 'shingles', 'team', 0.08);
    b.box(1.48, 4.55, 1.48, 0.045, 0.38, 0.045, 'bark', 'wood-dark');
    banner(b, 2.72, 2.72, 1.2, 1.65, 'team-light');
  },

  house: (b) => {
    taperedPrism(b, 1, 0, 1, 1.85, 1.85, 1.58, 1.55, 0.18, 'rock', 'stone-dark', 'stone-light');
    taperedPrism(b, 1, 0.18, 1, 1.62, 1.48, 1.42, 1.3, 1.05, 'planks', 'plaster');
    for (const x of [0.35, 1.65]) {
      taperedPrism(b, x, 0.2, 1.68, 0.13, 0.12, 0.09, 0.09, 0.98, 'planks', 'wood-dark');
    }
    b.box(0.79, 0.18, 1.67, 0.42, 0.72, 0.055, 'planks', 'wood-dark');
    windowInset(b, 0.38, 0.55, 1.68, 0.28, 0.28);
    b.gableRoof(0.2, 1.23, 0.24, 1.6, 1.5, 1.0, 'z', 'shingles', 'roof-red', 'plain', 'stone-light', 0.18);
    taperedPrism(b, 1.42, 1.65, 0.52, 0.28, 0.28, 0.2, 0.2, 0.85, 'bricks', 'brick', 'stone-light');
    b.box(0.72, 1.15, 1.72, 0.58, 0.09, 0.28, 'cloth', 'team');
    banner(b, 1.72, 0.35, 0.8, 0.95, 'team-light');
  },

  barracks: (b) => {
    taperedPrism(b, 1.5, 0, 1.5, 2.9, 2.9, 2.65, 2.6, 0.24, 'rock', 'stone-dark', 'stone-light');
    taperedPrism(b, 1.5, 0.24, 1.5, 2.62, 2.25, 2.38, 2.0, 1.35, 'bricks', 'stone');
    b.box(1.08, 0.24, 2.58, 0.84, 0.92, 0.07, 'planks', 'wood-dark');
    b.box(1.08, 1.08, 2.58, 0.84, 0.12, 0.1, 'rock', 'stone-light');
    for (const x of [0.38, 2.62]) {
      taperedPrism(b, x, 0.25, 2.58, 0.22, 0.18, 0.14, 0.12, 1.22, 'rock', 'stone-dark', 'stone-light');
      b.box(x - 0.1, 1.08, 2.58, 0.42, 0.08, 0.12, 'plain', 'gold');
    }
    b.gableRoof(
      0.22,
      1.6,
      0.38,
      2.56,
      2.22,
      1.12,
      'x',
      'shingles',
      'roof-slate',
      'plain',
      'stone-light',
      0.18,
    );
    banner(b, 0.58, 2.62, 0.85, 1.1, 'team');
    banner(b, 2.42, 2.62, 0.85, 1.1, 'team');
    // Raised signal lantern on the roof ridge.
    taperedPrism(b, 1.5, 2.72, 1.5, 0.42, 0.42, 0.28, 0.28, 0.7, 'bricks', 'stone-dark', 'gold');
    b.pyramidRoof(1.32, 3.42, 1.32, 0.36, 0.36, 0.55, 'shingles', 'team', 0.04);
  },

  stable: (b) => {
    taperedPrism(b, 1.5, 0, 1.5, 2.9, 2.9, 2.7, 2.65, 0.18, 'soil', 'dirt-dark', 'dirt');
    taperedPrism(b, 1.5, 0.18, 1.1, 2.55, 1.72, 2.35, 1.5, 0.92, 'planks', 'wood');
    for (const x of [0.48, 1.2, 1.92, 2.55]) {
      b.box(x, 0.18, 1.87, 0.08, 0.82, 0.08, 'planks', 'wood-dark');
    }
    for (const x of [0.58, 1.36, 2.12]) {
      b.box(x, 0.18, 1.9, 0.56, 0.34, 0.05, 'planks', 'wood-light');
      b.box(x + 0.12, 0.58, 1.86, 0.28, 0.24, 0.18, 'plain', 'horse');
    }
    b.gableRoof(0.2, 1.1, 0.28, 2.6, 1.72, 0.95, 'x', 'thatch', 'straw', 'planks', 'wood-light', 0.2);
    b.box(0.25, 1.76, 1.02, 2.5, 0.09, 0.12, 'cloth', 'team');
    // Paddock fence and water trough.
    for (const x of [0.18, 0.78, 2.2, 2.82]) b.box(x, 0.15, 2.72, 0.08, 0.48, 0.08, 'bark', 'wood-dark');
    b.box(0.18, 0.4, 2.72, 0.68, 0.06, 0.06, 'planks', 'wood-light');
    b.box(2.2, 0.4, 2.72, 0.68, 0.06, 0.06, 'planks', 'wood-light');
    b.box(0.32, 0.15, 2.2, 0.52, 0.18, 0.28, 'planks', 'wood-dark');
    b.box(0.36, 0.31, 2.23, 0.44, 0.04, 0.2, 'plain', 'water');
    banner(b, 2.75, 0.42, 0.65, 1.15, 'team-light');
  },

  // A big 4×4 field (M7b): thatched barn in the back corner, three crop bands of tapered tufts,
  // a fence all round with a gate on the front (+z) side, hay bales and a team scarecrow.
  farm: (b) => {
    b.box(0.05, 0, 0.05, 3.9, 0.07, 3.9, 'soil', 'dirt-dark', { top: 'soil', topColor: 'soil' });
    // barn
    taperedPrism(b, 0.9, 0.07, 0.85, 1.36, 1.2, 1.3, 1.14, 0.12, 'rock', 'stone-dark', 'stone');
    taperedPrism(b, 0.9, 0.19, 0.85, 1.2, 1.04, 1.12, 0.98, 0.64, 'planks', 'wood');
    b.box(0.69, 0.19, 1.36, 0.42, 0.5, 0.04, 'planks', 'wood-dark');
    windowInset(b, 0.42, 0.5, 1.37, 0.18, 0.16);
    b.gableRoof(0.34, 0.83, 0.36, 1.12, 0.98, 0.55, 'x', 'thatch', 'straw', 'planks', 'wood-light', 0.14);
    b.box(0.22, 1.36, 0.8, 1.36, 0.06, 0.1, 'cloth', 'team');
    // band 1: ripe wheat tufts beside the barn
    for (let row = 0; row < 4; row++) {
      const z = 0.4 + row * 0.27;
      b.box(1.78, 0.07, z - 0.07, 1.94, 0.03, 0.15, 'soil', 'dirt-dark');
      for (let col = 0; col < 7; col++)
        taperedPrism(
          b,
          1.92 + col * 0.27,
          0.1,
          z,
          0.16,
          0.12,
          0.06,
          0.05,
          0.3 + ((row + col) % 2) * 0.06,
          'leaves',
          'crop-ripe',
          'straw-light',
        );
    }
    // band 2: leafy green crops
    for (let row = 0; row < 3; row++) {
      const z = 1.72 + row * 0.32;
      b.box(0.3, 0.07, z - 0.09, 3.4, 0.03, 0.18, 'soil', 'dirt-dark');
      for (let col = 0; col < 11; col++)
        taperedPrism(
          b,
          0.42 + col * 0.3,
          0.1,
          z,
          0.18,
          0.18,
          0.1,
          0.1,
          0.16 + ((row + col) % 3) * 0.04,
          'leaves',
          (row + col) % 4 === 0 ? 'leaf' : 'crop',
          'leaf-light',
        );
    }
    // band 3: young sprouts near the gate
    for (let row = 0; row < 3; row++) {
      const z = 2.78 + row * 0.27;
      b.box(1.0, 0.07, z - 0.06, 2.72, 0.02, 0.13, 'soil', 'dirt-dark');
      for (let col = 0; col < 9; col++)
        taperedPrism(b, 1.12 + col * 0.3, 0.09, z, 0.08, 0.08, 0.03, 0.03, 0.1, 'leaves', 'leaf-light');
    }
    // hay bales
    taperedPrism(b, 0.52, 0.07, 2.92, 0.44, 0.34, 0.4, 0.3, 0.28, 'thatch', 'straw-light');
    taperedPrism(b, 0.55, 0.07, 3.32, 0.44, 0.34, 0.4, 0.3, 0.28, 'thatch', 'straw');
    taperedPrism(b, 0.54, 0.35, 3.12, 0.38, 0.3, 0.32, 0.26, 0.24, 'thatch', 'straw-light');
    // scarecrow: wide stick arms with straw tufts, a sack head and a dark hat (not a worker look-alike)
    b.boxC(3.22, 0.07, 2.05, 0.06, 1.02, 0.06, 'bark', 'wood-dark');
    b.box(2.86, 0.76, 2.03, 0.74, 0.06, 0.05, 'bark', 'wood');
    taperedPrism(b, 2.86, 0.68, 2.05, 0.06, 0.06, 0.14, 0.1, 0.16, 'thatch', 'straw-light');
    taperedPrism(b, 3.6, 0.68, 2.05, 0.06, 0.06, 0.14, 0.1, 0.16, 'thatch', 'straw-light');
    taperedPrism(b, 3.22, 0.46, 2.05, 0.36, 0.16, 0.26, 0.12, 0.36, 'cloth', 'team');
    b.boxC(3.22, 0.84, 2.05, 0.18, 0.17, 0.15, 'cloth', 'cloth');
    b.boxC(3.22, 1.0, 2.05, 0.32, 0.03, 0.3, 'plain', 'wood-dark');
    b.boxC(3.22, 1.03, 2.05, 0.17, 0.11, 0.15, 'plain', 'wood-dark');
    // fence with a gate gap on the front side
    const posts: Array<[number, number]> = [];
    for (let i = 0; i <= 4; i++) {
      const t = Math.min(3.9, i * 0.97 + 0.04);
      posts.push([t, 0.04], [0.04, t], [3.9, t]);
      if (t < 1.6 || t > 2.4) posts.push([t, 3.9]);
    }
    posts.push([1.56, 3.9], [2.38, 3.9]);
    for (const [x, z] of posts)
      taperedPrism(b, x + 0.04, 0, z + 0.04, 0.09, 0.09, 0.06, 0.06, 0.42, 'bark', 'wood-dark');
    for (const y of [0.17, 0.32]) {
      b.box(0.04, y, 0.06, 3.92, 0.045, 0.04, 'planks', 'wood-light');
      b.box(0.06, y, 0.04, 0.04, 0.045, 3.92, 'planks', 'wood-light');
      b.box(3.92, y, 0.04, 0.04, 0.045, 3.92, 'planks', 'wood-light');
      b.box(0.04, y, 3.92, 1.56, 0.045, 0.04, 'planks', 'wood-light');
      b.box(2.42, y, 3.92, 1.54, 0.045, 0.04, 'planks', 'wood-light');
    }
    banner(b, 2.42, 3.94, 0.1, 1.0, 'team');
  },

  // Siege Workshop (M7b): open timber shed on a stone footing, a half-built catapult frame inside,
  // a log pile, a spare wheel and a team banner.
  siegeWorkshop: (b) => {
    taperedPrism(b, 1.5, 0, 1.5, 2.9, 2.9, 2.7, 2.7, 0.16, 'rock', 'stone-dark', 'stone');
    b.box(0.3, 0.16, 0.3, 2.4, 0.92, 0.12, 'planks', 'wood');
    b.box(0.3, 0.16, 0.3, 0.12, 0.92, 1.85, 'planks', 'wood');
    for (const [x, z] of [
      [0.36, 2.1],
      [1.5, 2.1],
      [2.64, 2.1],
      [2.64, 0.36],
    ] as const)
      taperedPrism(b, x, 0.16, z, 0.16, 0.16, 0.11, 0.11, 0.92, 'planks', 'wood-dark');
    b.box(0.28, 1.04, 2.03, 2.44, 0.09, 0.14, 'planks', 'wood-dark');
    b.gableRoof(0.3, 1.1, 0.3, 2.4, 1.88, 0.62, 'x', 'shingles', 'roof-slate', 'planks', 'wood-light', 0.16);
    b.box(0.16, 1.7, 1.18, 2.68, 0.07, 0.1, 'cloth', 'team');
    // half-built catapult frame
    b.box(0.85, 0.26, 0.85, 1.3, 0.1, 0.12, 'planks', 'wood-light');
    b.box(0.85, 0.26, 1.55, 1.3, 0.1, 0.12, 'planks', 'wood-light');
    taperedPrism(b, 1.05, 0.36, 1.27, 0.12, 0.8, 0.08, 0.6, 0.5, 'planks', 'wood');
    b.box(1.3, 0.62, 1.22, 0.9, 0.08, 0.08, 'bark', 'wood-dark');
    for (const [x, z] of [
      [0.95, 0.8],
      [2.05, 0.8],
      [0.95, 1.72],
      [2.05, 1.72],
    ] as const)
      b.boxC(x, 0.16, z, 0.24, 0.24, 0.1, 'planks', 'wood-dark');
    // log pile, spare wheel, banner
    for (const z of [2.32, 2.5, 2.68])
      taperedPrism(b, 2.3, 0.16, z, 0.9, 0.16, 0.86, 0.12, 0.16, 'bark', 'wood', 'wood-light');
    taperedPrism(b, 2.3, 0.32, 2.41, 0.78, 0.16, 0.74, 0.12, 0.15, 'bark', 'wood', 'wood-light');
    b.box(2.76, 0.16, 0.7, 0.08, 0.62, 0.62, 'planks', 'wood-dark');
    b.box(2.8, 0.41, 0.95, 0.08, 0.12, 0.12, 'plain', 'iron');
    banner(b, 0.2, 2.78, 0.16, 1.45, 'team');
  },

  tower: (b) => {
    taperedPrism(b, 0.5, 0, 0.5, 1.42, 1.42, 1.08, 1.08, 2.75, 'bricks', 'stone', 'stone-light');
    b.box(0.28, 0.45, 1.02, 0.2, 0.55, 0.04, 'plain', 'shadow');
    b.box(1.02, 0.45, 0.28, 0.04, 0.55, 0.2, 'plain', 'shadow');
    b.box(0.38, 0, 1.0, 0.28, 0.58, 0.05, 'planks', 'wood-dark');
    b.box(-0.08, 2.75, -0.08, 1.16, 0.14, 1.16, 'rock', 'stone-dark');
    for (const [x, z] of [
      [-0.08, -0.08],
      [0.76, -0.08],
      [-0.08, 0.76],
      [0.76, 0.76],
    ] as const) {
      taperedPrism(b, x + 0.15, 2.89, z + 0.15, 0.3, 0.3, 0.22, 0.22, 0.55, 'bricks', 'stone-light');
    }
    b.pyramidRoof(-0.12, 3.42, -0.12, 1.24, 1.24, 1.35, 'shingles', 'team', 0.1);
    b.box(0.48, 4.75, 0.48, 0.05, 0.45, 0.05, 'bark', 'wood-dark');
    banner(b, 0.68, 0.48, 4.1, 0.8, 'team-light');
  },

  goldMine: (b) => {
    taperedPrism(b, 0.65, 0, 0.7, 1.0, 1.0, 0.72, 0.76, 0.85, 'rock', 'stone-dark', 'stone-light');
    taperedPrism(b, 1.45, 0, 0.62, 1.0, 0.95, 0.72, 0.7, 0.68, 'rock', 'stone', 'stone-light');
    taperedPrism(b, 1.05, 0, 1.42, 0.92, 0.9, 0.68, 0.65, 0.58, 'rock', 'stone-dark', 'stone');
    // Mine portal with timber braces.
    b.box(1.12, 0, 1.18, 0.68, 0.66, 0.06, 'plain', 'shadow');
    b.box(1.03, 0, 1.15, 0.09, 0.75, 0.09, 'planks', 'wood-dark');
    b.box(1.8, 0, 1.15, 0.09, 0.75, 0.09, 'planks', 'wood-dark');
    b.box(1.02, 0.67, 1.14, 0.88, 0.1, 0.12, 'planks', 'wood-light');
    for (const [x, y, z, s] of [
      [0.45, 0.48, 1.12, 0.13],
      [0.82, 0.76, 0.48, 0.16],
      [1.42, 0.42, 0.22, 0.14],
      [1.84, 0.38, 0.88, 0.12],
      [0.58, 0.25, 1.7, 0.12],
      [1.48, 0.86, 1.45, 0.13],
    ] as const) {
      b.box(x, y, z, s, s, s, 'plain', 'gold');
    }
    b.box(1.3, 0.08, 1.85, 0.42, 0.2, 0.28, 'planks', 'wood');
    b.box(1.33, 0.28, 1.88, 0.34, 0.06, 0.22, 'plain', 'gold');
  },

  berryBush: (b) => {
    taperedPrism(b, 0.45, 0, 0.48, 0.82, 0.72, 0.52, 0.48, 0.72, 'leaves', 'leaf-dark', 'leaf');
    taperedPrism(b, 0.83, 0.08, 0.35, 0.62, 0.62, 0.38, 0.38, 0.62, 'leaves', 'leaf', 'leaf-light');
    taperedPrism(b, 0.3, 0.06, 0.88, 0.55, 0.5, 0.34, 0.32, 0.56, 'leaves', 'leaf-dark', 'leaf');
    for (const [x, y, z] of [
      [0.2, 0.45, 0.82],
      [0.52, 0.58, 0.68],
      [0.92, 0.36, 0.52],
      [0.64, 0.22, 0.96],
      [0.98, 0.5, 0.2],
      [0.32, 0.27, 0.36],
    ] as const) {
      b.boxC(x, y, z, 0.075, 0.075, 0.075, 'plain', 'berry');
    }
  },
};

const HIP = 0.24;
const SHOULDER = 0.77;

function legPart(kit: UnitKit, color: string, x: number, z: number): LegPart {
  const part = kit.part();
  taperedPrism(part, 0, -HIP, 0, 0.075, 0.09, 0.12, 0.12, HIP, 'plain', color);
  part.boxC(0, -HIP + 0.025, 0, 0.15, 0.06, 0.18, 'cloth', 'wood-dark');
  return { geometry: part.build(), pivot: [x, HIP, z] };
}

function armPart(kit: UnitKit, color: string, x: number, tool?: (b: VoxelBuilder) => void): LegPart {
  const part = kit.part();
  taperedPrism(part, 0, -0.38, 0, 0.075, 0.09, 0.13, 0.12, 0.38, 'cloth', color);
  part.boxC(0, -0.41, 0.01, 0.09, 0.08, 0.1, 'plain', 'skin');
  tool?.(part);
  return { geometry: part.build(), pivot: [x, SHOULDER, 0] };
}

function person(
  kit: UnitKit,
  tunic: string,
  armor: string,
  legs: string,
  helmet: string,
  tool?: (b: VoxelBuilder) => void,
): void {
  const b = kit.body;
  taperedPrism(b, 0, HIP, 0, 0.34, 0.24, 0.27, 0.19, 0.57, 'cloth', tunic);
  taperedPrism(b, 0, HIP + 0.2, 0.015, 0.36, 0.25, 0.29, 0.2, 0.25, 'plain', armor, 'iron');
  b.boxC(0, HIP + 0.17, 0.02, 0.37, 0.07, 0.26, 'cloth', 'wood-dark');
  b.boxC(0, 0.91, 0.015, 0.2, 0.25, 0.19, 'plain', 'skin');
  b.boxC(0, 1.035, 0.015, 0.22, 0.12, 0.22, 'plain', helmet);
  b.boxC(0, 0.92, 0.115, 0.11, 0.035, 0.018, 'plain', 'shadow');
  b.boxC(0.065, 0.98, 0.12, 0.025, 0.025, 0.02, 'plain', 'ink');
  b.boxC(-0.065, 0.98, 0.12, 0.025, 0.025, 0.02, 'plain', 'ink');
  // Shoulder plates and a short rear mantle create a layered silhouette.
  taperedPrism(b, -0.2, 0.69, 0, 0.19, 0.2, 0.14, 0.15, 0.14, 'plain', armor, 'iron');
  taperedPrism(b, 0.2, 0.69, 0, 0.19, 0.2, 0.14, 0.15, 0.14, 'plain', armor, 'iron');
  b.boxC(0, 0.55, -0.14, 0.28, 0.43, 0.055, 'cloth', 'team-dark');
  kit.arms.push(armPart(kit, tunic, -0.2));
  kit.arms.push(armPart(kit, tunic, 0.2, tool));
  kit.legs.push(legPart(kit, legs, -0.085, 0));
  kit.legs.push(legPart(kit, legs, 0.085, 0));
}

function horse(kit: UnitKit, coat: string, mane: string, barding?: string): void {
  const b = kit.body;
  taperedPrism(b, 0, 0.38, 0, 0.38, 0.78, 0.31, 0.64, 0.42, 'plain', coat);
  if (barding) {
    taperedPrism(b, 0, 0.43, 0, 0.4, 0.68, 0.34, 0.55, 0.27, 'cloth', barding);
    b.boxC(0, 0.52, 0.31, 0.22, 0.09, 0.08, 'plain', 'gold');
  }
  taperedPrism(b, 0, 0.62, 0.27, 0.23, 0.28, 0.16, 0.19, 0.47, 'plain', coat);
  b.boxC(0, 1.02, 0.43, 0.18, 0.16, 0.27, 'plain', coat);
  b.boxC(0, 1.08, 0.35, 0.08, 0.2, 0.24, 'plain', mane);
  b.boxC(0, 0.74, -0.43, 0.07, 0.34, 0.08, 'plain', mane);
  for (const [x, z] of [
    [-0.13, 0.24],
    [0.13, 0.24],
    [-0.13, -0.24],
    [0.13, -0.24],
  ] as const) {
    const part = kit.part();
    taperedPrism(part, 0, -0.38, 0, 0.07, 0.08, 0.1, 0.1, 0.38, 'plain', mane);
    returnLeg(kit, part, x, 0.39, z);
  }
}

function returnLeg(kit: UnitKit, part: VoxelBuilder, x: number, y: number, z: number): void {
  kit.legs.push({ geometry: part.build(), pivot: [x, y, z] });
}

function rider(kit: UnitKit, armored: boolean): void {
  horse(kit, armored ? 'horse' : 'wood-light', 'horse-dark', armored ? 'team-dark' : undefined);
  const b = kit.body;
  taperedPrism(b, 0, 0.9, -0.02, 0.29, 0.22, 0.24, 0.18, 0.42, 'cloth', armored ? 'iron-dark' : 'leather');
  b.boxC(0, 1.08, -0.02, 0.2, 0.22, 0.18, 'plain', armored ? 'iron' : 'skin');
  b.boxC(0, 1.22, -0.02, 0.24, 0.12, 0.22, 'plain', armored ? 'iron-dark' : 'team');
  if (armored) {
    b.boxC(0, 1.18, 0.1, 0.18, 0.035, 0.02, 'plain', 'shadow');
    b.boxC(0, 1.36, -0.02, 0.06, 0.22, 0.08, 'cloth', 'team-light');
  } else {
    b.boxC(0, 1.31, -0.02, 0.26, 0.07, 0.22, 'cloth', 'team-light');
  }
  b.boxC(0.2, 1.0, 0.14, 0.045, 0.045, 0.78, 'bark', 'wood-dark');
  b.pyramidRoof(0.16, 1.0, 0.5, 0.12, 0.12, 0.2, 'plain', 'iron', 0.01);
  b.boxC(-0.2, 0.9, 0.04, 0.045, 0.28, 0.2, 'planks', 'team');
}

const units: ArtCollectionParts['units'] = {
  worker: (kit) => {
    const axe = (a: VoxelBuilder): void => {
      a.boxC(0.02, -0.18, 0.06, 0.035, 0.36, 0.035, 'bark', 'wood-dark');
      taperedPrism(a, 0.03, -0.02, 0.1, 0.18, 0.08, 0.12, 0.05, 0.14, 'plain', 'iron');
    };
    person(kit, 'team-light', 'leather', 'wood-dark', 'straw', axe);
    kit.body.pyramidRoof(-0.18, 1.13, -0.18, 0.36, 0.36, 0.22, 'thatch', 'straw-light', 0.02);
    kit.body.boxC(0, 0.83, 0.13, 0.12, 0.08, 0.05, 'cloth', 'wood-dark');
  },

  militia: (kit) => {
    const spear = (a: VoxelBuilder): void => {
      a.boxC(0.02, -0.06, 0.05, 0.035, 0.72, 0.035, 'bark', 'wood-dark');
      a.pyramidRoof(0.0, 0.28, 0.0, 0.08, 0.08, 0.18, 'plain', 'iron', 0.01);
    };
    person(kit, 'team', 'iron-dark', 'leather', 'iron', spear);
    taperedPrism(
      kit.body,
      -0.22,
      0.28,
      0.08,
      0.3,
      0.12,
      0.23,
      0.08,
      0.52,
      'planks',
      'team-dark',
      'team-light',
    );
    kit.body.boxC(-0.22, 0.56, 0.15, 0.12, 0.12, 0.035, 'plain', 'gold');
    kit.body.boxC(0, 1.14, 0.02, 0.06, 0.16, 0.07, 'cloth', 'team-light');
  },

  // Heavy foot soldier: plate, a crested full helm, a tall tapered shield and a short sword.
  guard: (kit) => {
    const sword = (a: VoxelBuilder): void => {
      a.boxC(0.02, -0.4, 0.08, 0.06, 0.04, 0.16, 'plain', 'gold');
      a.boxC(0.02, -0.39, 0.3, 0.045, 0.03, 0.4, 'plain', 'iron');
    };
    person(kit, 'iron-dark', 'iron', 'iron-dark', 'iron', sword);
    const b = kit.body;
    b.boxC(0, 0.94, 0.02, 0.23, 0.2, 0.21, 'plain', 'iron'); // closed helm over the face
    b.boxC(0, 0.97, 0.13, 0.15, 0.035, 0.02, 'plain', 'shadow'); // visor slit
    b.boxC(0, 1.16, 0.0, 0.06, 0.14, 0.2, 'cloth', 'team-light'); // crest
    taperedPrism(b, -0.25, 0.22, 0.1, 0.36, 0.1, 0.3, 0.08, 0.68, 'planks', 'team', 'team-light');
    b.boxC(-0.25, 0.6, 0.16, 0.12, 0.12, 0.035, 'plain', 'gold');
    b.boxC(-0.25, 0.9, 0.1, 0.32, 0.04, 0.1, 'plain', 'iron-dark');
  },

  // Light skirmisher: bare-headed with a team headband, a stone pouch and a loaded sling.
  slinger: (kit) => {
    const sling = (a: VoxelBuilder): void => {
      a.boxC(0.025, -0.52, 0.03, 0.018, 0.2, 0.018, 'plain', 'leather');
      a.boxC(-0.025, -0.52, 0.03, 0.018, 0.2, 0.018, 'plain', 'leather');
      taperedPrism(a, 0, -0.68, 0.03, 0.1, 0.1, 0.07, 0.07, 0.08, 'rock', 'stone', 'stone-light');
    };
    person(kit, 'team-light', 'cloth', 'leather', 'skin', sling);
    const b = kit.body;
    b.boxC(0, 1.06, 0.015, 0.23, 0.05, 0.23, 'cloth', 'team'); // headband
    b.boxC(-0.13, 0.4, 0.13, 0.14, 0.14, 0.08, 'plain', 'leather'); // pouch
    b.boxC(-0.13, 0.54, 0.13, 0.08, 0.04, 0.05, 'rock', 'stone-light');
  },

  archer: (kit) => {
    person(kit, 'team-dark', 'leather', 'leather', 'team-dark');
    kit.body.boxC(0, 1.1, -0.1, 0.26, 0.17, 0.2, 'cloth', 'team');
    kit.body.boxC(0.08, 0.57, -0.16, 0.12, 0.38, 0.1, 'planks', 'wood-dark');
    // Tall recurved bow assembled from narrow segments; still readable at map zoom.
    kit.body.boxC(-0.25, 0.63, 0.05, 0.045, 0.68, 0.045, 'bark', 'wood-light');
    kit.body.boxC(-0.29, 0.95, 0.05, 0.12, 0.045, 0.045, 'bark', 'wood-light');
    kit.body.boxC(-0.29, 0.31, 0.05, 0.12, 0.045, 0.045, 'bark', 'wood-light');
    kit.body.boxC(-0.25, 0.63, 0.075, 0.012, 0.68, 0.012, 'plain', 'cloth');
  },

  scoutRider: (kit) => rider(kit, false),

  knight: (kit) => {
    rider(kit, true);
    kit.body.boxC(-0.2, 0.9, 0.04, 0.06, 0.3, 0.22, 'planks', 'team');
    kit.body.boxC(0.2, 1.0, 0.1, 0.05, 0.05, 0.9, 'bark', 'wood-dark');
    kit.body.pyramidRoof(0.16, 1.0, 0.5, 0.12, 0.12, 0.2, 'plain', 'iron', 0.01);
  },

  catapult: (kit) => {
    const b = kit.body;
    taperedPrism(b, 0, 0.16, 0, 0.55, 1.0, 0.48, 0.88, 0.14, 'planks', 'wood');
    for (const x of [-0.31, 0.31]) {
      b.boxC(x, 0.18, 0, 0.07, 0.12, 1.0, 'planks', 'wood-dark');
    }
    // Polygonal wheels: six broad facets instead of square blocks.
    for (const x of [-0.34, 0.34]) {
      const cx = x,
        cy = 0.2,
        cz = 0;
      const r = 0.2,
        half = 0.055;
      const ring: V3[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6;
        ring.push(v(cx, cy + Math.cos(a) * r, cz + Math.sin(a) * r));
      }
      const ring2 = ring.map((p) => v(p[0] + (x > 0 ? half : -half), p[1], p[2]));
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        b.quad('planks', 'wood-dark', ring[i], ring[j], ring2[j], ring2[i]);
      }
      b.boxC(cx + (x > 0 ? half + 0.01 : -half - 0.01), cy, cz, 0.08, 0.08, 0.08, 'plain', 'iron');
    }
    taperedPrism(b, 0, 0.3, 0.08, 0.2, 0.18, 0.13, 0.13, 0.52, 'planks', 'wood-light');
    b.boxC(0, 0.75, -0.12, 0.08, 0.78, 0.08, 'bark', 'wood-dark');
    b.boxC(0, 1.12, -0.35, 0.26, 0.08, 0.24, 'planks', 'wood-dark');
    b.boxC(0, 1.18, -0.35, 0.16, 0.12, 0.15, 'rock', 'stone');
    b.boxC(0, 0.28, 0.4, 0.32, 0.16, 0.18, 'cloth', 'team-dark');
  },
};

const trees: ArtCollectionParts['trees'] = {
  oak: (b) => {
    taperedPrism(b, 0, 0, 0, 0.24, 0.24, 0.18, 0.18, 0.78, 'bark', 'wood-dark', 'wood');
    taperedPrism(b, -0.2, 0.55, 0.02, 0.82, 0.82, 0.55, 0.55, 0.82, 'leaves', 'leaf-dark', 'leaf');
    taperedPrism(b, 0.22, 0.88, -0.08, 0.68, 0.66, 0.42, 0.42, 0.72, 'leaves', 'leaf', 'leaf-light');
    taperedPrism(b, -0.08, 1.28, 0.12, 0.46, 0.48, 0.24, 0.24, 0.52, 'leaves', 'leaf-light');
  },
  oakTall: (b) => {
    taperedPrism(b, 0, 0, 0, 0.22, 0.22, 0.16, 0.16, 1.15, 'bark', 'wood-dark', 'wood');
    taperedPrism(b, 0, 0.88, 0, 0.92, 0.88, 0.65, 0.62, 0.9, 'leaves', 'leaf-dark', 'leaf');
    taperedPrism(b, -0.18, 1.42, 0.08, 0.68, 0.68, 0.42, 0.42, 0.8, 'leaves', 'leaf', 'leaf-light');
    taperedPrism(b, 0.12, 1.9, -0.06, 0.4, 0.4, 0.18, 0.18, 0.62, 'leaves', 'leaf-light');
  },
  pine: (b) => {
    taperedPrism(b, 0, 0, 0, 0.18, 0.18, 0.14, 0.14, 0.62, 'bark', 'wood-dark');
    b.pyramidRoof(-0.52, 0.42, -0.52, 1.04, 1.04, 0.85, 'leaves', 'pine', 0.08);
    b.pyramidRoof(-0.43, 0.98, -0.43, 0.86, 0.86, 0.82, 'leaves', 'leaf-dark', 0.06);
    b.pyramidRoof(-0.31, 1.52, -0.31, 0.62, 0.62, 0.78, 'leaves', 'leaf', 0.04);
  },
  pineSmall: (b) => {
    taperedPrism(b, 0, 0, 0, 0.15, 0.15, 0.12, 0.12, 0.42, 'bark', 'wood-dark');
    b.pyramidRoof(-0.38, 0.28, -0.38, 0.76, 0.76, 0.62, 'leaves', 'pine', 0.05);
    b.pyramidRoof(-0.28, 0.68, -0.28, 0.56, 0.56, 0.56, 'leaves', 'leaf-dark', 0.04);
  },
};

const rockBlocks: ArtCollectionParts['rockBlocks'] = [
  (b) => {
    taperedPrism(b, 0, 0, 0, 1.0, 1.0, 0.64, 0.68, 0.52, 'rock', 'stone-dark', 'stone-light');
    taperedPrism(b, 0.1, 0.52, -0.04, 0.66, 0.64, 0.4, 0.4, 0.42, 'rock', 'stone', 'stone-light');
  },
  (b) => {
    taperedPrism(b, 0, 0, 0, 1.0, 0.96, 0.78, 0.7, 0.38, 'rock', 'stone-dark', 'stone');
    taperedPrism(b, -0.12, 0.38, 0.08, 0.58, 0.58, 0.3, 0.34, 0.54, 'rock', 'stone', 'stone-light');
  },
  (b) => {
    taperedPrism(b, 0, 0, 0, 1.0, 1.0, 0.74, 0.72, 0.72, 'rock', 'stone', 'stone-light');
    taperedPrism(b, 0.04, 0.72, 0.02, 0.72, 0.7, 0.36, 0.36, 0.48, 'rock', 'stone-dark', 'stone');
  },
];

const boulder: ArtCollectionParts['boulder'] = (b) => {
  taperedPrism(b, 0, 0, 0, 0.62, 0.58, 0.38, 0.34, 0.42, 'rock', 'stone-dark', 'stone-light');
  taperedPrism(b, 0.1, 0.42, -0.02, 0.38, 0.34, 0.16, 0.16, 0.28, 'rock', 'stone', 'stone-light');
};

const wall: ArtCollectionParts['wall'] = (b, axis) => {
  if (axis === 'x') {
    taperedPrism(b, 0.5, 0, 0.5, 1.0, 0.66, 0.88, 0.56, 1.12, 'bricks', 'stone-dark', 'stone-light');
    for (const x of [0.16, 0.5, 0.84]) {
      taperedPrism(b, x, 1.12, 0.5, 0.2, 0.66, 0.16, 0.56, 0.32, 'bricks', 'stone', 'stone-light');
    }
  } else {
    taperedPrism(b, 0.5, 0, 0.5, 0.66, 1.0, 0.56, 0.88, 1.12, 'bricks', 'stone-dark', 'stone-light');
    for (const z of [0.16, 0.5, 0.84]) {
      taperedPrism(b, 0.5, 1.12, z, 0.66, 0.2, 0.56, 0.16, 0.32, 'bricks', 'stone', 'stone-light');
    }
  }
};

const constructionSite: ArtCollectionParts['constructionSite'] = (b, w, d, height) => {
  b.box(0.04, 0, 0.04, w - 0.08, 0.08, d - 0.08, 'soil', 'dirt-dark', {
    top: 'planks',
    topColor: 'wood-light',
  });
  const posts: Array<[number, number]> = [];
  for (let x = 0; x <= w; x += Math.max(1, w / Math.ceil(w / 1.4))) posts.push([x, 0], [x, d]);
  for (let z = 0; z <= d; z += Math.max(1, d / Math.ceil(d / 1.4))) posts.push([0, z], [w, z]);
  for (const [px, pz] of posts) {
    const x = Math.min(w - 0.1, Math.max(0.04, px - 0.04));
    const z = Math.min(d - 0.1, Math.max(0.04, pz - 0.04));
    taperedPrism(
      b,
      x + 0.04,
      0.08,
      z + 0.04,
      0.12,
      0.12,
      0.08,
      0.08,
      height,
      'planks',
      'wood-dark',
      'wood-light',
    );
  }
  for (const y of [height * 0.42, height * 0.82]) {
    b.box(0.04, y, 0.04, w - 0.08, 0.07, 0.07, 'planks', 'wood-light');
    b.box(0.04, y, d - 0.1, w - 0.08, 0.07, 0.07, 'planks', 'wood-light');
    b.box(0.04, y, 0.04, 0.07, 0.07, d - 0.08, 'planks', 'wood-light');
    b.box(w - 0.1, y, 0.04, 0.07, 0.07, d - 0.08, 'planks', 'wood-light');
  }
  b.box(0.2, 0.08, 0.2, Math.min(0.75, w * 0.3), 0.16, 0.22, 'planks', 'wood');
  b.box(w - 0.5, 0.08, d - 0.45, 0.28, 0.22, 0.28, 'rock', 'stone');
};

const constructionCore: ArtCollectionParts['constructionCore'] = (b, w, d) => {
  taperedPrism(b, w / 2, 0, d / 2, w - 0.5, d - 0.5, w - 0.8, d - 0.8, 1.1, 'planks', 'wood-light', 'straw');
};

const rubble: ArtCollectionParts['rubble'] = (b, w, d) => {
  b.box(0.05, 0, 0.05, w - 0.1, 0.05, d - 0.1, 'soil', 'dirt-dark');
  let seed = Math.round(w * 37 + d * 19);
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const pieces = Math.round(w * d * 3);
  for (let i = 0; i < pieces; i++) {
    const size = 0.12 + rnd() * 0.22;
    const x = 0.1 + rnd() * Math.max(0.1, w - 0.25 - size);
    const z = 0.1 + rnd() * Math.max(0.1, d - 0.25 - size);
    if (rnd() < 0.28) {
      b.box(x, 0.05, z, size * 2.0, 0.07, 0.07, 'planks', 'wood-dark');
    } else {
      taperedPrism(
        b,
        x + size / 2,
        0.05,
        z + size / 2,
        size,
        size,
        size * 0.65,
        size * 0.65,
        size * (0.35 + rnd() * 0.5),
        'rock',
        rnd() < 0.5 ? 'stone-dark' : 'stone',
      );
    }
  }
};

const projectiles: NonNullable<ArtCollection['projectiles']> = {
  arrow: (b) => {
    b.boxC(0, 0, 0, 0.025, 0.025, 0.44, 'bark', 'wood-light');
    b.pyramidRoof(-0.045, -0.035, 0.16, 0.09, 0.09, 0.16, 'plain', 'iron', 0.01);
    b.boxC(0, 0, -0.22, 0.08, 0.045, 0.1, 'cloth', 'team-light');
  },
  pebble: (b) => {
    taperedPrism(b, 0, -0.04, 0, 0.09, 0.09, 0.06, 0.06, 0.08, 'rock', 'stone', 'stone-light');
  },
  stone: (b) => {
    taperedPrism(b, 0, -0.08, 0, 0.2, 0.2, 0.12, 0.12, 0.18, 'rock', 'stone-dark', 'stone-light');
  },
};

export const aetherfall: ArtCollection = {
  id: 'aetherfall',
  name: 'Aetherfall',
  // Only overrides are listed here. The collection loader merges these maps with Classic.
  colors,
  iconInk,
  buildings,
  units,
  trees,
  rockBlocks,
  boulder,
  wall,
  constructionSite,
  constructionCore,
  rubble,
  projectiles,
};
