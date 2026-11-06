/**
 * Voxel model definitions (PLAN §7). All art is made in code from boxes + roofs + pixel textures.
 *
 * Conventions (1 world unit = 1 map tile):
 *  - Buildings / resources: origin at the footprint's min corner, footprint w×d tiles on +x/+z.
 *  - Units / trees: origin at the center of the feet, facing +z.
 *  - Colors are palette ids; 'team', 'team-light', 'team-dark' are swapped per player.
 */
import * as THREE from 'three';
import { voxelMaterial } from './materials';
import { resolveColor, type TeamName } from './palette';
import { VoxelBuilder, type BuiltGeometry } from './VoxelBuilder';

export type BuildingModel = 'townHall' | 'house' | 'barracks' | 'farm' | 'tower' | 'goldMine' | 'berryBush';
export type WallAxis = 'x' | 'z';
export type UnitModel = 'worker' | 'militia' | 'archer' | 'knight';
export type TreeModel = 'oak' | 'oakTall' | 'pine' | 'pineSmall';

function builder(team: TeamName): VoxelBuilder {
  return new VoxelBuilder().setColorFilter((c) =>
    typeof c === 'string' && !c.startsWith('#') ? resolveColor(c, team) : c,
  );
}

export function meshFrom(built: BuiltGeometry): THREE.Mesh {
  const mesh = new THREE.Mesh(
    built.geometry,
    built.textures.map((t) => voxelMaterial(t)),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ---- Buildings ----------------------------------------------------------------------------------

const BUILDINGS: Record<BuildingModel, (b: VoxelBuilder) => void> = {
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

export function buildingGeometry(model: BuildingModel, team: TeamName): BuiltGeometry {
  const b = builder(team);
  BUILDINGS[model](b);
  return b.build();
}

/** One 1×1 wall segment running along `axis`, with merlons. */
export function wallGeometry(axis: WallAxis): BuiltGeometry {
  const b = builder('blue');
  if (axis === 'x') {
    b.box(0, 0, 0.22, 1, 0.95, 0.56, 'bricks', 'stone', { top: 'rock', topColor: 'stone-dark' });
    b.box(0.05, 0.95, 0.22, 0.34, 0.24, 0.56, 'bricks', 'stone');
    b.box(0.6, 0.95, 0.22, 0.34, 0.24, 0.56, 'bricks', 'stone');
  } else {
    b.box(0.22, 0, 0, 0.56, 0.95, 1, 'bricks', 'stone', { top: 'rock', topColor: 'stone-dark' });
    b.box(0.22, 0.95, 0.05, 0.56, 0.24, 0.34, 'bricks', 'stone');
    b.box(0.22, 0.95, 0.6, 0.56, 0.24, 0.34, 'bricks', 'stone');
  }
  return b.build();
}

// ---- Trees ---------------------------------------------------------------------------------------

export function treeGeometry(model: TreeModel): BuiltGeometry {
  const b = builder('blue');
  switch (model) {
    case 'oak':
      b.boxC(0, 0, 0, 0.2, 0.55, 0.2, 'bark', 'bark');
      b.boxC(0, 0.42, 0, 0.86, 0.55, 0.86, 'leaves', 'leaf');
      b.boxC(0.06, 0.97, -0.04, 0.6, 0.32, 0.6, 'leaves', 'leaf-light');
      break;
    case 'oakTall':
      b.boxC(0, 0, 0, 0.22, 0.75, 0.22, 'bark', 'bark');
      b.boxC(0, 0.6, 0, 0.95, 0.6, 0.95, 'leaves', 'leaf-dark');
      b.boxC(-0.05, 1.2, 0.05, 0.7, 0.4, 0.7, 'leaves', 'leaf');
      b.boxC(0.05, 1.6, 0, 0.36, 0.2, 0.36, 'leaves', 'leaf-light');
      break;
    case 'pine':
      b.boxC(0, 0, 0, 0.16, 0.4, 0.16, 'bark', 'bark');
      b.boxC(0, 0.3, 0, 0.82, 0.38, 0.82, 'leaves', 'pine');
      b.boxC(0, 0.68, 0, 0.62, 0.36, 0.62, 'leaves', 'pine');
      b.boxC(0, 1.04, 0, 0.42, 0.34, 0.42, 'leaves', 'leaf-dark');
      b.boxC(0, 1.38, 0, 0.2, 0.22, 0.2, 'leaves', 'leaf-dark');
      break;
    case 'pineSmall':
      b.boxC(0, 0, 0, 0.14, 0.3, 0.14, 'bark', 'bark');
      b.boxC(0, 0.22, 0, 0.6, 0.3, 0.6, 'leaves', 'pine');
      b.boxC(0, 0.52, 0, 0.42, 0.28, 0.42, 'leaves', 'pine');
      b.boxC(0, 0.8, 0, 0.22, 0.22, 0.22, 'leaves', 'leaf-dark');
      break;
  }
  return b.build();
}

/** Boulder block that fills one 'rock' terrain tile (3 variants). Origin: tile center. */
export function rockBlockGeometry(variant: 0 | 1 | 2): BuiltGeometry {
  const b = builder('blue');
  if (variant === 0) {
    b.boxC(0, 0, 0, 0.98, 0.5, 0.98, 'rock', 'stone', { topColor: 'stone-light' });
    b.boxC(0.12, 0.5, -0.06, 0.62, 0.32, 0.6, 'rock', 'stone', { topColor: 'stone-light' });
    b.boxC(-0.2, 0.82, 0.05, 0.3, 0.16, 0.3, 'rock', 'stone-light');
  } else if (variant === 1) {
    b.boxC(0, 0, 0, 0.98, 0.34, 0.98, 'rock', 'stone-dark', { topColor: 'stone' });
    b.boxC(-0.15, 0.34, 0.1, 0.56, 0.42, 0.58, 'rock', 'stone', { topColor: 'stone-light' });
    b.boxC(0.28, 0.34, -0.25, 0.32, 0.22, 0.34, 'rock', 'stone');
  } else {
    b.boxC(0, 0, 0, 0.98, 0.7, 0.98, 'rock', 'stone', { topColor: 'stone-light' });
    b.boxC(0.05, 0.7, 0.05, 0.7, 0.4, 0.66, 'rock', 'stone-dark', { topColor: 'stone' });
    b.boxC(-0.06, 1.1, -0.04, 0.36, 0.2, 0.36, 'rock', 'stone');
  }
  return b.build();
}

export function rockGeometry(): BuiltGeometry {
  const b = builder('blue');
  b.boxC(0, 0, 0, 0.5, 0.3, 0.42, 'rock', 'stone');
  b.boxC(0.12, 0.3, -0.02, 0.28, 0.16, 0.26, 'rock', 'stone-light');
  b.boxC(-0.22, 0, 0.15, 0.22, 0.16, 0.2, 'rock', 'stone-dark');
  return b.build();
}

// ---- Units ---------------------------------------------------------------------------------------

/** A unit is a group: a merged body plus separate legs so they can swing when walking. */
export interface UnitParts {
  group: THREE.Group;
  legs: THREE.Object3D[];
}

function humanoid(b: VoxelBuilder, y0: number, torso: string, arms: string): void {
  b.boxC(0, y0, 0, 0.26, 0.2, 0.16, 'cloth', torso);
  b.boxC(0, y0 + 0.03, 0, 0.27, 0.035, 0.17, 'plain', 'leather');
  b.boxC(0.165, y0 + 0.03, 0, 0.07, 0.17, 0.09, 'cloth', arms);
  b.boxC(-0.165, y0 + 0.03, 0, 0.07, 0.17, 0.09, 'cloth', arms);
  b.boxC(0.165, y0, 0, 0.065, 0.04, 0.085, 'plain', 'skin');
  b.boxC(-0.165, y0, 0, 0.065, 0.04, 0.085, 'plain', 'skin');
  b.boxC(0, y0 + 0.2, 0, 0.21, 0.2, 0.2, 'plain', 'skin');
  b.boxC(0.05, y0 + 0.28, 0.1, 0.035, 0.045, 0.01, 'plain', 'ink');
  b.boxC(-0.05, y0 + 0.28, 0.1, 0.035, 0.045, 0.01, 'plain', 'ink');
}

function legMesh(
  team: TeamName,
  color: string,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const b = builder(team);
  b.box(-w / 2, -h, -d / 2, w, h, d, 'plain', color);
  const mesh = meshFrom(b.build());
  mesh.position.set(x, y, z); // pivot at the hip
  return mesh;
}

export function buildUnit(model: UnitModel, team: TeamName): UnitParts {
  const b = builder(team);
  const group = new THREE.Group();
  const legs: THREE.Object3D[] = [];
  const hip = 0.17;

  if (model === 'knight') {
    // horse
    b.boxC(0, 0.3, 0, 0.3, 0.26, 0.62, 'plain', 'horse');
    b.boxC(0, 0.3, 0, 0.34, 0.15, 0.5, 'cloth', 'team');
    b.boxC(0, 0.45, 0.27, 0.18, 0.3, 0.18, 'plain', 'horse');
    b.boxC(0, 0.65, 0.39, 0.16, 0.14, 0.28, 'plain', 'horse');
    b.boxC(0, 0.72, 0.3, 0.05, 0.12, 0.2, 'plain', 'horse-dark'); // mane
    b.boxC(0, 0.42, -0.34, 0.06, 0.22, 0.08, 'plain', 'horse-dark'); // tail
    // rider
    b.boxC(0, 0.56, -0.02, 0.26, 0.2, 0.18, 'plain', 'iron');
    b.boxC(0, 0.56, 0.0, 0.27, 0.06, 0.19, 'cloth', 'team');
    b.boxC(0.16, 0.58, 0, 0.07, 0.17, 0.09, 'plain', 'iron-dark');
    b.boxC(-0.16, 0.58, 0, 0.07, 0.17, 0.09, 'plain', 'iron-dark');
    b.boxC(0, 0.76, -0.02, 0.22, 0.21, 0.21, 'plain', 'iron');
    b.boxC(0, 0.83, 0.09, 0.16, 0.035, 0.01, 'plain', 'ink'); // visor slit
    b.boxC(0, 0.97, -0.02, 0.05, 0.08, 0.16, 'cloth', 'team-light'); // plume
    b.boxC(0.2, 0.62, 0.25, 0.04, 0.04, 0.9, 'bark', 'wood'); // lance
    b.boxC(0.2, 0.61, 0.72, 0.06, 0.06, 0.1, 'plain', 'iron');
    b.boxC(-0.21, 0.5, 0.02, 0.04, 0.24, 0.2, 'planks', 'team'); // shield
    for (const [x, z] of [
      [0.1, 0.22],
      [-0.1, 0.22],
      [0.1, -0.22],
      [-0.1, -0.22],
    ] as const)
      legs.push(legMesh(team, 'horse-dark', 0.08, 0.3, 0.08, x, 0.3, z));
  } else {
    const torso = model === 'worker' ? 'team-light' : 'team';
    humanoid(b, hip, torso, model === 'worker' ? 'cloth' : 'team-dark');
    if (model === 'worker') {
      b.boxC(0, hip + 0.4, 0, 0.32, 0.035, 0.32, 'thatch', 'straw');
      b.boxC(0, hip + 0.435, 0, 0.17, 0.06, 0.17, 'thatch', 'straw');
      b.boxC(0.2, hip - 0.02, 0.07, 0.03, 0.3, 0.03, 'bark', 'wood'); // axe handle
      b.boxC(0.2, hip + 0.22, 0.11, 0.03, 0.08, 0.08, 'plain', 'iron');
    } else if (model === 'militia') {
      b.boxC(0, hip + 0.37, 0, 0.23, 0.09, 0.23, 'plain', 'iron');
      b.boxC(0, hip + 0.33, 0, 0.26, 0.03, 0.26, 'plain', 'iron-dark');
      b.boxC(0.2, hip - 0.1, 0.07, 0.03, 0.82, 0.03, 'bark', 'wood'); // spear
      b.boxC(0.2, hip + 0.72, 0.07, 0.05, 0.1, 0.05, 'plain', 'iron');
      b.boxC(-0.21, hip - 0.02, 0.02, 0.04, 0.22, 0.19, 'planks', 'team'); // shield
      b.boxC(-0.235, hip + 0.07, 0.02, 0.02, 0.05, 0.05, 'plain', 'iron');
    } else {
      // archer
      b.boxC(0, hip + 0.33, -0.01, 0.23, 0.13, 0.23, 'cloth', 'team-dark');
      b.boxC(0, hip + 0.38, -0.12, 0.12, 0.06, 0.04, 'cloth', 'team-dark');
      b.boxC(-0.22, hip - 0.08, 0.06, 0.03, 0.46, 0.03, 'bark', 'wood-light'); // bow
      b.boxC(-0.22, hip + 0.38, 0.03, 0.03, 0.04, 0.06, 'bark', 'wood-light');
      b.boxC(-0.22, hip - 0.12, 0.03, 0.03, 0.04, 0.06, 'bark', 'wood-light');
      b.boxC(0.06, hip + 0.03, -0.11, 0.08, 0.24, 0.06, 'plain', 'leather'); // quiver
      b.boxC(0.06, hip + 0.27, -0.11, 0.06, 0.05, 0.04, 'plain', 'cloth');
    }
    const legColor = model === 'militia' ? 'iron-dark' : 'leather';
    legs.push(legMesh(team, legColor, 0.09, hip, 0.1, 0.065, hip, 0));
    legs.push(legMesh(team, legColor, 0.09, hip, 0.1, -0.065, hip, 0));
  }

  const body = meshFrom(b.build());
  group.add(body, ...legs);
  group.name = `${team}:${model}`;
  return { group, legs };
}
