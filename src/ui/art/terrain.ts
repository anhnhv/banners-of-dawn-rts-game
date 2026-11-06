/**
 * Terrain mesh for a tile grid (grid x → world x, grid y → world z; 1 tile = 1 world unit).
 * - Land tiles are flat quads at y = 0 sampling one big pixel texture (TEXELS_PER_TILE per tile).
 *   Borders between terrain types are ragged and blocky, which gives the voxel/pixel look.
 * - Water has one flat surface level; shallow fords have a shallow bed, deep water a deep one.
 * - Steps between beds get earthy bank sides, and the map edge gets vertical "diorama" sides.
 */
import * as THREE from 'three';
import type { TerrainType } from '../../shared';
import { hex } from './palette';
import { voxelMaterial } from './materials';
import { pixelTexture } from './textures';
import { VoxelBuilder } from './VoxelBuilder';

export type { TerrainType };

export interface TerrainGrid {
  width: number;
  height: number;
  /** Row-major: tiles[y * width + x]. */
  tiles: readonly TerrainType[];
}

export const TEXELS_PER_TILE = 8;
export const WATER_SURFACE = -0.08;
const EDGE_DEPTH = -1.2;

/** Height of the ground (or the river bed) for each terrain type. */
const BED: Record<TerrainType, number> = {
  grass: 0,
  dirt: 0,
  sand: 0,
  rock: 0,
  shallow: -0.17,
  water: -0.4,
};

const SHADES: Record<TerrainType, string[]> = {
  grass: ['grass', 'grass', 'grass-light', 'grass-dark'],
  dirt: ['dirt', 'dirt', 'dirt-dark', 'sand-dark'],
  sand: ['sand', 'sand', 'sand-dark', 'plaster'],
  rock: ['stone', 'stone-dark', 'stone', 'stone-light'],
  shallow: ['sand', 'sand-dark', 'sand', 'plaster'],
  water: ['sand-dark', 'sand-dark', 'dirt', 'sand'],
};

const isWet = (t: TerrainType | null): boolean => t === 'water' || t === 'shallow';

export interface TerrainView {
  group: THREE.Group;
  /** Call every frame for the water animation. */
  update(timeSeconds: number): void;
}

export function buildTerrain(grid: TerrainGrid, seed = 1): TerrainView {
  const group = new THREE.Group();
  group.name = 'terrain';
  const texture = paintTerrainTexture(grid, seed);
  const tileAt = (x: number, y: number): TerrainType | null =>
    x < 0 || y < 0 || x >= grid.width || y >= grid.height
      ? null
      : (grid.tiles[y * grid.width + x] ?? 'grass');

  // ---- Ground quads ---------------------------------------------------------------------------------
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const h = BED[tileAt(x, y) ?? 'grass'];
      const base = positions.length / 3;
      positions.push(x, h, y + 1, x + 1, h, y + 1, x + 1, h, y, x, h, y);
      const u0 = x / grid.width;
      const u1 = (x + 1) / grid.width;
      const v0 = y / grid.height;
      const v1 = (y + 1) / grid.height;
      uvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const ground = new THREE.BufferGeometry();
  ground.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  ground.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  ground.setIndex(indices);
  ground.computeVertexNormals();
  const groundMesh = new THREE.Mesh(ground, new THREE.MeshLambertMaterial({ map: texture }));
  groundMesh.receiveShadow = true;
  groundMesh.name = 'ground';
  group.add(groundMesh);

  // ---- Bank sides between bed heights, and the map edge -------------------------------------------
  const sides = new VoxelBuilder();
  const bank = hex('dirt-dark');
  const edge = hex('dirt');
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const here = BED[tileAt(x, y) ?? 'grass'];
      const neighbours: Array<[number, number, Side]> = [
        [x + 1, y, 'px'],
        [x - 1, y, 'nx'],
        [x, y + 1, 'pz'],
        [x, y - 1, 'nz'],
      ];
      for (const [nx, ny, dir] of neighbours) {
        const other = tileAt(nx, ny);
        if (other === null) sideQuad(sides, x, y, dir, EDGE_DEPTH, here, edge);
        else if (BED[other] < here) sideQuad(sides, x, y, dir, BED[other], here, bank);
      }
    }
  }
  const builtSides = sides.build();
  const sidesMesh = new THREE.Mesh(
    builtSides.geometry,
    builtSides.textures.map((t) => voxelMaterial(t)),
  );
  sidesMesh.receiveShadow = true;
  group.add(sidesMesh);

  // ---- Water surface (one level for deep and shallow water) ---------------------------------------
  const waterTex = pixelTexture('water').clone();
  waterTex.needsUpdate = true;
  const water = new VoxelBuilder();
  let hasWater = false;
  const s = WATER_SURFACE;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const t = tileAt(x, y);
      if (!isWet(t)) continue;
      hasWater = true;
      const color = hex(t === 'shallow' ? 'shallow' : 'water');
      water.quad('water', color, [x, s, y + 1], [x + 1, s, y + 1], [x + 1, s, y], [x, s, y]);
    }
  }
  if (hasWater) {
    const builtWater = water.build();
    const waterMesh = new THREE.Mesh(
      builtWater.geometry,
      new THREE.MeshLambertMaterial({
        map: waterTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    waterMesh.name = 'water';
    waterMesh.renderOrder = 1;
    group.add(waterMesh);
  }

  return {
    group,
    update(time) {
      waterTex.offset.set((time * 0.04) % 1, (time * 0.025) % 1);
    },
  };
}

type Side = 'px' | 'nx' | 'pz' | 'nz';

function sideQuad(
  b: VoxelBuilder,
  x: number,
  y: number,
  dir: Side,
  bottom: number,
  top: number,
  color: string,
): void {
  if (top - bottom <= 0) return;
  const x1 = x + 1;
  const y1 = y + 1;
  // One outward-facing quad on the tile edge (CCW as seen from outside).
  if (dir === 'px') b.quad('rock', color, [x1, bottom, y1], [x1, bottom, y], [x1, top, y], [x1, top, y1]);
  if (dir === 'nx') b.quad('rock', color, [x, bottom, y], [x, bottom, y1], [x, top, y1], [x, top, y]);
  if (dir === 'pz') b.quad('rock', color, [x, bottom, y1], [x1, bottom, y1], [x1, top, y1], [x, top, y1]);
  if (dir === 'nz') b.quad('rock', color, [x1, bottom, y], [x, bottom, y], [x, top, y], [x1, top, y]);
}

/** Paint the ground texture: blocky noise shades + ragged pixel borders between terrain types. */
function paintTerrainTexture(grid: TerrainGrid, seed: number): THREE.CanvasTexture {
  const W = grid.width * TEXELS_PER_TILE;
  const H = grid.height * TEXELS_PER_TILE;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available.');
  const image = ctx.createImageData(W, H);
  const rgb = new Map<string, [number, number, number]>();
  const toRgb = (id: string): [number, number, number] => {
    let c = rgb.get(id);
    if (!c) {
      const h = hex(id); // "#rrggbb" in sRGB, exactly what the canvas wants
      c = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      rgb.set(id, c);
    }
    return c;
  };
  const tileAt = (tx: number, ty: number): TerrainType => {
    const cx = Math.min(grid.width - 1, Math.max(0, tx));
    const cy = Math.min(grid.height - 1, Math.max(0, ty));
    return grid.tiles[cy * grid.width + cx] ?? 'grass';
  };

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const own = tileAt(Math.floor(px / TEXELS_PER_TILE), Math.floor(py / TEXELS_PER_TILE));
      // Ragged borders: jitter the sample position in 2×2-texel blocks (land only; water beds keep
      // their own color so the bank sides line up).
      const bx = px >> 1;
      const by = py >> 1;
      let type = own;
      if (!isWet(own)) {
        const jx = (hash(bx, by, seed) % 5) - 2;
        const jy = (hash(bx, by, seed + 17) % 5) - 2;
        const sampled = tileAt(
          Math.floor((px + jx) / TEXELS_PER_TILE),
          Math.floor((py + jy) / TEXELS_PER_TILE),
        );
        if (!isWet(sampled)) type = sampled;
      }
      const shades = SHADES[type];
      const r = hash(bx, by, seed + 101) % 100;
      const shade = r < 52 ? shades[0] : r < 74 ? shades[1] : r < 90 ? shades[2] : shades[3];
      const [cr, cg, cb] = toRgb(shade ?? 'grass');
      const i = (py * W + px) * 4;
      image.data[i] = cr;
      image.data[i + 1] = cg;
      image.data[i + 2] = cb;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  return texture;
}

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
