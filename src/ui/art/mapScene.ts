/**
 * Builds the static 3D scene of a decoded map: terrain, rock outcrops, trees, resources,
 * decoration and the two starting Town Halls.
 * Repeated objects use one InstancedMesh per model, so thousands of trees cost a few draw calls.
 */
import * as THREE from 'three';
import type { DecodedMap, MapObject } from '../../shared';
import { voxelMaterial } from './materials';
import {
  buildingGeometry,
  meshFrom,
  rockBlockGeometry,
  rockGeometry,
  treeGeometry,
  type TreeModel,
} from './models';
import { buildTerrain, type TerrainView } from './terrain';
import type { BuiltGeometry } from './VoxelBuilder';

export interface MapScene {
  group: THREE.Group;
  terrain: TerrainView;
}

/** Deterministic per-tile random number in [0, 1). */
function rand(x: number, y: number, salt: number): number {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

class InstanceBatch {
  private readonly matrices: THREE.Matrix4[] = [];
  constructor(private readonly geometry: () => BuiltGeometry) {}

  add(x: number, y: number, z: number, rotationY: number, scale: THREE.Vector3): void {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY),
      scale,
    );
    this.matrices.push(m);
  }

  toMesh(name: string): THREE.InstancedMesh | null {
    if (this.matrices.length === 0) return null;
    const built = this.geometry();
    const mesh = new THREE.InstancedMesh(
      built.geometry,
      built.textures.map((t) => voxelMaterial(t)),
      this.matrices.length,
    );
    this.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    mesh.name = name;
    return mesh;
  }
}

export function buildMapScene(map: DecodedMap): MapScene {
  const group = new THREE.Group();
  group.name = `map:${map.id}`;
  const terrain = buildTerrain({ width: map.width, height: map.height, tiles: map.terrain }, 7);
  group.add(terrain.group);

  const trees: Record<TreeModel, InstanceBatch> = {
    oak: new InstanceBatch(() => treeGeometry('oak')),
    oakTall: new InstanceBatch(() => treeGeometry('oakTall')),
    pine: new InstanceBatch(() => treeGeometry('pine')),
    pineSmall: new InstanceBatch(() => treeGeometry('pineSmall')),
  };
  const rocks = [0, 1, 2].map((v) => new InstanceBatch(() => rockBlockGeometry(v as 0 | 1 | 2)));
  const stones = new InstanceBatch(rockGeometry);
  const goldMines = new InstanceBatch(() => buildingGeometry('goldMine', 'blue'));
  const berries = new InstanceBatch(() => buildingGeometry('berryBush', 'blue'));
  const one = new THREE.Vector3(1, 1, 1);

  // Rock outcrops fill every 'rock' terrain tile.
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.terrain[y * map.width + x] !== 'rock') continue;
      const batch = rocks[Math.floor(rand(x, y, 3) * 3)] ?? rocks[0];
      const s = 0.85 + rand(x, y, 4) * 0.4;
      batch?.add(
        x + 0.5,
        0,
        y + 0.5,
        Math.floor(rand(x, y, 5) * 4) * (Math.PI / 2),
        new THREE.Vector3(1, s, 1),
      );
    }
  }

  for (const o of map.objects) {
    switch (o.kind) {
      case 'tree':
      case 'pine':
        addTree(trees, o);
        break;
      case 'gold_mine':
        goldMines.add(o.x, 0, o.y, 0, one);
        break;
      case 'berry_bush':
        berries.add(o.x, 0, o.y, 0, one);
        break;
      case 'stone':
        stones.add(o.x + 0.5, 0, o.y + 0.5, rand(o.x, o.y, 9) * Math.PI * 2, one);
        break;
      case 'spawn': {
        const hall = meshFrom(buildingGeometry('townHall', o.player === 1 ? 'red' : 'blue'));
        hall.position.set(o.x, 0, o.y);
        hall.name = `townHall:p${(o.player ?? 0) + 1}`;
        group.add(hall);
        break;
      }
    }
  }

  const batches: Array<[string, InstanceBatch]> = [
    ...Object.entries(trees).map(([k, b]) => [`trees:${k}`, b] as [string, InstanceBatch]),
    ...rocks.map((b, i) => [`rock:${i}`, b] as [string, InstanceBatch]),
    ['stones', stones],
    ['goldMines', goldMines],
    ['berryBushes', berries],
  ];
  for (const [name, batch] of batches) {
    const mesh = batch.toMesh(name);
    if (mesh) group.add(mesh);
  }
  return { group, terrain };
}

function addTree(trees: Record<TreeModel, InstanceBatch>, o: MapObject): void {
  const r = rand(o.x, o.y, 1);
  const model: TreeModel =
    o.kind === 'pine' ? (r < 0.62 ? 'pine' : 'pineSmall') : r < 0.62 ? 'oak' : r < 0.9 ? 'oakTall' : 'pine';
  const k = 0.85 + rand(o.x, o.y, 2) * 0.3;
  trees[model].add(
    o.x + 0.5 + (rand(o.x, o.y, 6) - 0.5) * 0.25,
    0,
    o.y + 0.5 + (rand(o.x, o.y, 7) - 0.5) * 0.25,
    Math.floor(rand(o.x, o.y, 8) * 4) * (Math.PI / 2),
    new THREE.Vector3(k, k * (0.9 + rand(o.x, o.y, 10) * 0.2), k),
  );
}
