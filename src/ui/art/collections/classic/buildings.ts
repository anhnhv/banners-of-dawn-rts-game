/** Classic buildings and resource-node models (origin: footprint min corner). */
import type { ArtCollectionParts } from '../types';

export const buildings: ArtCollectionParts['buildings'] = {
  townHall: (b) => {
    b.box(0.1, 0, 0.1, 2.8, 0.25, 2.8, 'bricks', 'stone', { top: 'rock', topColor: 'stone-light' });
    b.box(1.1, 0, 2.6, 0.8, 0.12, 0.35, 'rock', 'stone'); // steps
    b.box(0.35, 0.25, 0.45, 2.3, 1.0, 2.1, 'plain', 'plaster');
    // timber frame
    for (const x of [0.33, 1.42, 2.6]) b.box(x, 0.25, 2.53, 0.08, 1.0, 0.04, 'planks', 'wood-dark');
    for (const z of [0.43, 1.45, 2.47]) b.box(2.63, 0.25, z, 0.04, 1.0, 0.08, 'planks', 'wood-dark');
    b.box(0.33, 0.86, 2.53, 2.35, 0.07, 0.04, 'planks', 'wood-dark');
    b.box(2.63, 0.86, 0.43, 0.04, 0.07, 2.12, 'planks', 'wood-dark');
    b.box(1.22, 0.25, 2.54, 0.56, 0.62, 0.05, 'planks', 'wood-dark'); // door
    b.box(0.55, 0.5, 2.54, 0.42, 0.28, 0.04, 'plain', 'shadow'); // windows
    b.box(1.98, 0.5, 2.54, 0.42, 0.28, 0.04, 'plain', 'shadow');
    b.box(2.64, 0.5, 0.75, 0.04, 0.28, 0.42, 'plain', 'shadow');
    b.box(2.64, 0.5, 1.8, 0.04, 0.28, 0.42, 'plain', 'shadow');
    b.gableRoof(0.35, 1.25, 0.45, 2.3, 2.1, 0.95, 'x', 'shingles', 'roof-red', 'plain', 'plaster', 0.16);
    // central bell tower with a team-colored spire
    b.box(1.05, 1.25, 1.05, 0.9, 1.5, 0.9, 'bricks', 'stone');
    b.box(1.25, 2.25, 1.94, 0.5, 0.35, 0.03, 'plain', 'shadow');
    b.box(1.94, 2.25, 1.25, 0.03, 0.35, 0.5, 'plain', 'shadow');
    b.box(0.98, 2.75, 0.98, 1.04, 0.1, 1.04, 'rock', 'stone-dark');
    b.pyramidRoof(1.0, 2.85, 1.0, 1.0, 1.0, 0.95, 'shingles', 'team', 0.06);
    // banner
    b.box(2.72, 0.25, 2.72, 0.06, 1.7, 0.06, 'bark', 'wood-dark');
    b.box(2.78, 1.45, 2.73, 0.46, 0.32, 0.03, 'cloth', 'team');
  },

  house: (b) => {
    b.box(0.15, 0, 0.15, 1.7, 0.16, 1.7, 'bricks', 'stone-dark', { top: 'rock', topColor: 'stone' });
    b.box(0.28, 0.16, 0.3, 1.44, 0.72, 1.36, 'planks', 'wood-light');
    for (const x of [0.26, 1.66]) b.box(x, 0.16, 1.62, 0.08, 0.72, 0.08, 'planks', 'wood-dark');
    b.box(0.86, 0.16, 1.66, 0.3, 0.48, 0.04, 'planks', 'wood-dark'); // door
    b.box(0.42, 0.42, 1.665, 0.26, 0.2, 0.04, 'plain', 'shadow'); // window
    b.box(1.72, 0.42, 0.62, 0.04, 0.2, 0.3, 'plain', 'shadow');
    b.box(0.78, 0.66, 1.66, 0.46, 0.05, 0.2, 'cloth', 'team'); // awning
    b.gableRoof(0.28, 0.88, 0.3, 1.44, 1.36, 0.72, 'z', 'thatch', 'straw', 'planks', 'wood', 0.13);
    b.box(1.22, 0.95, 0.5, 0.22, 0.95, 0.22, 'bricks', 'brick'); // chimney
  },

  barracks: (b) => {
    b.box(0.1, 0, 0.1, 2.8, 0.2, 2.8, 'rock', 'stone-dark', { topColor: 'stone' });
    b.box(0.25, 0.2, 0.55, 2.5, 0.6, 1.95, 'bricks', 'stone');
    b.box(0.25, 0.8, 0.55, 2.5, 0.42, 1.95, 'planks', 'wood');
    b.box(1.12, 0.2, 2.48, 0.76, 0.78, 0.05, 'planks', 'wood-dark'); // gate
    b.box(1.1, 0.98, 2.47, 0.8, 0.08, 0.06, 'rock', 'stone-dark');
    b.box(0.45, 0.42, 2.505, 0.3, 0.68, 0.03, 'cloth', 'team'); // banners
    b.box(2.25, 0.42, 2.505, 0.3, 0.68, 0.03, 'cloth', 'team');
    b.box(0.45, 0.38, 2.505, 0.3, 0.05, 0.035, 'plain', 'gold');
    b.box(2.25, 0.38, 2.505, 0.3, 0.05, 0.035, 'plain', 'gold');
    b.gableRoof(
      0.25,
      1.22,
      0.55,
      2.5,
      1.95,
      0.9,
      'x',
      'shingles',
      'roof-slate',
      'planks',
      'wood-light',
      0.16,
    );
    // weapon rack on the side
    b.box(2.78, 0.2, 0.9, 0.06, 0.55, 0.06, 'planks', 'wood-dark');
    b.box(2.78, 0.2, 2.0, 0.06, 0.55, 0.06, 'planks', 'wood-dark');
    b.box(2.78, 0.62, 0.9, 0.06, 0.06, 1.16, 'planks', 'wood-dark');
    for (let i = 0; i < 4; i++) {
      const z = 1.05 + i * 0.26;
      b.box(2.86, 0.2, z, 0.03, 0.95, 0.03, 'bark', 'wood');
      b.box(2.85, 1.12, z - 0.01, 0.05, 0.1, 0.05, 'plain', 'iron');
    }
  },

  // long low barn with open horse stalls and a small paddock in front (reads differently from the
  // tall stone Barracks: lower, wooden, thatched, horses looking out)
  stable: (b) => {
    b.box(0.1, 0, 0.1, 2.8, 0.12, 2.8, 'soil', 'dirt-dark', { top: 'soil', topColor: 'dirt' });
    b.box(0.2, 0.12, 0.35, 2.6, 0.12, 1.6, 'rock', 'stone-dark', { topColor: 'stone' }); // footing
    b.box(0.25, 0.24, 0.4, 2.5, 0.7, 1.5, 'planks', 'wood');
    // three open stalls on the front, two with a horse looking out
    for (const [i, x] of [0.42, 1.2, 1.98].entries()) {
      b.box(x, 0.24, 1.9, 0.6, 0.56, 0.03, 'plain', 'shadow');
      b.box(x, 0.24, 1.91, 0.6, 0.2, 0.04, 'planks', 'wood-light'); // half door
      if (i !== 1) {
        b.box(x + 0.2, 0.5, 1.88, 0.2, 0.2, 0.2, 'plain', i === 0 ? 'horse' : 'horse-dark'); // head
        b.box(x + 0.23, 0.7, 1.98, 0.04, 0.07, 0.04, 'plain', 'horse-dark'); // ears
        b.box(x + 0.33, 0.7, 1.98, 0.04, 0.07, 0.04, 'plain', 'horse-dark');
      }
    }
    for (const x of [0.25, 1.06, 1.84, 2.66]) b.box(x, 0.24, 1.88, 0.09, 0.72, 0.06, 'planks', 'wood-dark');
    b.box(0.25, 0.86, 1.88, 2.5, 0.08, 0.06, 'planks', 'wood-dark'); // lintel
    b.gableRoof(0.25, 0.94, 0.4, 2.5, 1.5, 0.62, 'x', 'thatch', 'straw', 'planks', 'wood-light', 0.14);
    b.box(0.12, 1.53, 1.1, 2.76, 0.07, 0.1, 'cloth', 'team'); // team-colored ridge
    // paddock fence along the front, open in the middle
    for (const x of [0.14, 0.78, 2.14, 2.78]) b.box(x, 0.12, 2.76, 0.08, 0.36, 0.08, 'bark', 'wood-dark');
    for (const [x0, x1] of [
      [0.14, 0.86],
      [2.14, 2.86],
    ] as const) {
      b.box(x0, 0.24, 2.78, x1 - x0, 0.05, 0.04, 'planks', 'wood-light');
      b.box(x0, 0.38, 2.78, x1 - x0, 0.05, 0.04, 'planks', 'wood-light');
    }
    // hay bale, water trough and a banner
    b.box(2.25, 0.12, 2.15, 0.45, 0.3, 0.35, 'thatch', 'straw-light');
    b.box(0.3, 0.12, 2.25, 0.55, 0.2, 0.25, 'planks', 'wood-dark');
    b.box(0.35, 0.2, 2.3, 0.45, 0.05, 0.15, 'plain', 'water');
    b.box(2.82, 0.12, 0.42, 0.06, 1.7, 0.06, 'bark', 'wood-dark');
    b.box(2.88, 1.35, 0.43, 0.4, 0.3, 0.03, 'cloth', 'team');
  },

  farm: (b) => {
    b.box(0.1, 0, 0.1, 1.8, 0.05, 1.8, 'soil', 'soil');
    for (let i = 0; i < 5; i++) {
      const ripe = i % 2 === 0;
      b.box(0.2, 0.05, 0.22 + i * 0.33, 1.6, ripe ? 0.16 : 0.12, 0.17, 'leaves', ripe ? 'crop-ripe' : 'crop');
    }
    for (const [x, z] of [
      [0.04, 0.04],
      [1.88, 0.04],
      [0.04, 1.88],
      [1.88, 1.88],
    ] as const)
      b.box(x, 0, z, 0.08, 0.3, 0.08, 'bark', 'wood');
    b.box(0.04, 0.18, 0.06, 1.92, 0.05, 0.04, 'planks', 'wood-light');
    b.box(0.06, 0.18, 0.04, 0.04, 0.05, 1.92, 'planks', 'wood-light');
    // scarecrow in team colors
    b.box(1.55, 0.05, 1.55, 0.05, 0.6, 0.05, 'bark', 'wood');
    b.box(1.38, 0.45, 1.555, 0.4, 0.05, 0.04, 'bark', 'wood');
    b.box(1.47, 0.32, 1.53, 0.21, 0.22, 0.1, 'cloth', 'team');
    b.box(1.5, 0.55, 1.53, 0.15, 0.13, 0.1, 'thatch', 'straw-light');
  },

  tower: (b) => {
    b.box(-0.08, 0, -0.08, 1.16, 2.05, 1.16, 'bricks', 'stone');
    b.box(0.42, 0.9, 1.085, 0.16, 0.42, 0.03, 'plain', 'shadow'); // arrow slits
    b.box(1.085, 0.9, 0.42, 0.03, 0.42, 0.16, 'plain', 'shadow');
    b.box(0.38, 0, 1.08, 0.24, 0.5, 0.04, 'planks', 'wood-dark'); // door
    b.box(-0.16, 2.05, -0.16, 1.32, 0.12, 1.32, 'rock', 'stone-dark', { topColor: 'stone' });
    for (const [x, z] of [
      [-0.16, -0.16],
      [0.86, -0.16],
      [-0.16, 0.86],
      [0.86, 0.86],
      [0.35, -0.16],
      [0.35, 0.86],
      [-0.16, 0.35],
      [0.86, 0.35],
    ] as const)
      b.box(x, 2.17, z, 0.3, 0.26, 0.3, 'bricks', 'stone');
    for (const [x, z] of [
      [-0.02, -0.02],
      [0.94, -0.02],
      [-0.02, 0.94],
      [0.94, 0.94],
    ] as const)
      b.box(x, 2.17, z, 0.08, 0.5, 0.08, 'planks', 'wood-dark');
    b.pyramidRoof(-0.1, 2.67, -0.1, 1.2, 1.2, 0.8, 'shingles', 'team', 0.08);
    b.box(0.47, 3.4, 0.47, 0.05, 0.5, 0.05, 'bark', 'wood-dark');
    b.box(0.52, 3.62, 0.48, 0.32, 0.2, 0.03, 'cloth', 'team-light');
  },

  goldMine: (b) => {
    b.box(0.15, 0, 0.2, 1.1, 0.75, 1.0, 'rock', 'stone');
    b.box(0.9, 0, 0.15, 0.95, 0.55, 0.95, 'rock', 'stone-dark');
    b.box(0.3, 0, 1.0, 0.8, 0.45, 0.85, 'rock', 'stone');
    b.box(0.35, 0.75, 0.35, 0.6, 0.35, 0.6, 'rock', 'stone-light');
    // gold veins
    for (const [x, y, z, s] of [
      [0.5, 0.4, 1.19, 0.16],
      [0.8, 0.6, 1.19, 0.12],
      [1.24, 0.35, 0.5, 0.14],
      [1.84, 0.3, 0.6, 0.12],
      [0.62, 1.05, 0.62, 0.15],
      [1.3, 0.42, 1.09, 0.14],
      [0.95, 0.2, 1.84, 0.13],
    ] as const)
      b.box(x, y, z, s, s, s, 'plain', 'gold');
    // timber mine entrance
    b.box(1.15, 0, 1.15, 0.08, 0.6, 0.08, 'planks', 'wood');
    b.box(1.65, 0, 1.15, 0.08, 0.6, 0.08, 'planks', 'wood');
    b.box(1.1, 0.6, 1.12, 0.68, 0.1, 0.14, 'planks', 'wood-dark');
    b.box(1.23, 0, 1.12, 0.42, 0.55, 0.04, 'plain', 'ink');
    b.box(1.3, 0, 1.6, 0.35, 0.18, 0.28, 'planks', 'wood'); // ore cart
    b.box(1.32, 0.18, 1.62, 0.31, 0.06, 0.24, 'plain', 'gold');
  },

  berryBush: (b) => {
    b.box(0.15, 0, 0.18, 0.7, 0.42, 0.65, 'leaves', 'leaf');
    b.box(0.25, 0.42, 0.26, 0.5, 0.14, 0.48, 'leaves', 'leaf-light');
    for (const [x, y, z] of [
      [0.3, 0.3, 0.83],
      [0.6, 0.18, 0.83],
      [0.45, 0.48, 0.74],
      [0.85, 0.25, 0.4],
      [0.85, 0.12, 0.7],
      [0.65, 0.56, 0.4],
    ] as const)
      b.box(x, y, z, 0.07, 0.07, 0.03, 'plain', 'berry');
  },
};
