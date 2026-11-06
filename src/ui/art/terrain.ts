/**
 * Terrain mesh for a tile grid (grid x → world x, grid y → world z; 1 tile = 1 world unit).
 * - Land tiles are flat quads at y = 0 sampling one big pixel texture (TEXELS_PER_TILE per tile).
 *   Borders between terrain types are ragged and blocky, which gives the voxel/pixel look.
 * - Water tiles sit lower, with a translucent animated surface and earthy bank sides.
 * - The map edge gets vertical "diorama" sides.
 */
import * as THREE from 'three';
import { hex } from './palette';
import { voxelMaterial } from './materials';
import { pixelTexture } from './textures';
import { VoxelBuilder } from './VoxelBuilder';

export type TerrainType = 'grass' | 'dirt' | 'sand' | 'water';

export interface TerrainGrid {
  width: number;
  height: number;
  /** Row-major: tiles[y * width + x]. */
  tiles: TerrainType[];
}

export const TEXELS_PER_TILE = 8;
const WATER_BED = -0.38;
const WATER_SURFACE = -0.1;
const EDGE_DEPTH = -1.2;

const SHADES: Record<TerrainType, string[]> = {
  grass: ['grass', 'grass', 'grass-light', 'grass-dark'],
  dirt: ['dirt', 'dirt', 'dirt-dark', 'sand-dark'],
  sand: ['sand', 'sand', 'sand-dark', 'plaster'],
  water: ['sand-dark', 'sand-dark', 'dirt', 'sand'],
};

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

  // ---- Ground quads (land at 0, water bed lower) ------------------------------------------------
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const h = tileAt(x, y) === 'water' ? WATER_BED : 0;
      const base = positions.length / 3;
      positions.push(x, h, y + 1, x + 1, h, y + 1, x + 1, h, y, x, h, y);
      uvs.push(
        x / grid.width,
        (y + 1) / grid.height,
        (x + 1) / grid.width,
        (y + 1) / grid.height,
        (x + 1) / grid.width,
        y / grid.height,
        x / grid.width,
        y / grid.height,
      );
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

  // ---- Banks (land ↔ water) and map-edge sides ---------------------------------------------------
  const sides = new VoxelBuilder();
  const bank = hex('dirt-dark');
  const edge = hex('dirt');
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const here = tileAt(x, y);
      const top = here === 'water' ? WATER_BED : 0;
      const neighbours: Array<[number, number, 'px' | 'nx' | 'pz' | 'nz']> = [
        [x + 1, y, 'px'],
        [x - 1, y, 'nx'],
        [x, y + 1, 'pz'],
        [x, y - 1, 'nz'],
      ];
      for (const [nx, ny, dir] of neighbours) {
        const other = tileAt(nx, ny);
        if (other === null) {
          sideQuad(sides, x, y, dir, EDGE_DEPTH, top, edge);
        } else if (here !== 'water' && other === 'water') {
          sideQuad(sides, x, y, dir, WATER_BED, 0, bank);
        }
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

  // ---- Water surface -------------------------------------------------------------------------------
  const waterTex = pixelTexture('water').clone();
  waterTex.needsUpdate = true;
  waterTex.repeat.set(1, 1);
  const water = new VoxelBuilder();
  let hasWater = false;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (tileAt(x, y) !== 'water') continue;
      hasWater = true;
      const s = WATER_SURFACE;
      water.quad('water', hex('water'), [x, s, y + 1], [x + 1, s, y + 1], [x + 1, s, y], [x, s, y]);
    }
  }
  const waterMaterial = new THREE.MeshLambertMaterial({
    map: waterTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  if (hasWater) {
    const builtWater = water.build();
    const waterMesh = new THREE.Mesh(builtWater.geometry, waterMaterial);
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

function sideQuad(
  b: VoxelBuilder,
  x: number,
  y: number,
  dir: 'px' | 'nx' | 'pz' | 'nz',
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
      // Ragged borders: jitter the sample position in 2×2-texel blocks.
      const bx = px >> 1;
      const by = py >> 1;
      const jx = (hash(bx, by, seed) % 5) - 2;
      const jy = (hash(bx, by, seed + 17) % 5) - 2;
      const type = tileAt(Math.floor((px + jx) / TEXELS_PER_TILE), Math.floor((py + jy) / TEXELS_PER_TILE));
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
