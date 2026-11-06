/**
 * Pixel textures for the voxel models (PLAN §7). Each one is a 16×16 grayscale pattern; the model's
 * vertex colors tint it, so a single "planks" texture works for any wood color.
 * Textures are drawn in code (no image files) and sampled with nearest filtering up close,
 * which gives the chunky pixel look.
 */
import * as THREE from 'three';
import { Rng } from '../../shared';

export type TexKey =
  | 'plain'
  | 'planks'
  | 'bricks'
  | 'shingles'
  | 'thatch'
  | 'leaves'
  | 'bark'
  | 'rock'
  | 'soil'
  | 'cloth'
  | 'water';

export const TEX_SIZE = 16;

type Setter = (x: number, y: number, v: number) => void;
type Painter = (set: Setter, rng: Rng) => void;

const each = (fn: (x: number, y: number) => void): void => {
  for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) fn(x, y);
};

const PAINTERS: Record<TexKey, Painter> = {
  plain: (set, rng) => each((x, y) => set(x, y, 238 + rng.int(0, 17))),

  planks: (set, rng) => {
    for (let row = 0; row < 4; row++) {
      const joint = rng.int(2, 13);
      const shade = rng.int(-10, 8);
      for (let y = row * 4; y < row * 4 + 4; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
          let v = 226 + shade + rng.int(0, 12);
          if (y === row * 4 + 3) v = 150;
          else if (y === row * 4) v = 248;
          if (x === joint && y !== row * 4 + 3) v = 160;
          set(x, y, v);
        }
      }
    }
  },

  bricks: (set, rng) => {
    for (let row = 0; row < 4; row++) {
      const offset = row % 2 === 0 ? 0 : 4;
      const shades = [rng.int(-14, 10), rng.int(-14, 10), rng.int(-14, 10)];
      for (let y = row * 4; y < row * 4 + 4; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
          const bx = (x + offset) % TEX_SIZE;
          const brick = Math.floor((x + offset) / 8) % 3;
          let v = 226 + (shades[brick] ?? 0) + rng.int(0, 10);
          if (y === row * 4 + 3 || bx % 8 === 7) v = 165;
          else if (y === row * 4) v += 12;
          set(x, y, v);
        }
      }
    }
  },

  shingles: (set, rng) => {
    for (let row = 0; row < 4; row++) {
      const offset = row % 2 === 0 ? 0 : 2;
      for (let y = row * 4; y < row * 4 + 4; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
          const tx = (x + offset) % 4;
          const ty = y - row * 4;
          let v = 246 - ty * 10 + rng.int(0, 8);
          if (ty === 3) v = 150;
          else if (tx === 0) v -= 30;
          set(x, y, v);
        }
      }
    }
  },

  thatch: (set, rng) => {
    const cols = Array.from({ length: TEX_SIZE }, () => 205 + rng.int(0, 35));
    each((x, y) => {
      let v = (cols[x] ?? 220) + rng.int(-12, 12);
      if (y % 6 === 5) v -= 45;
      set(x, y, v);
    });
  },

  leaves: (set, rng) => {
    for (let by = 0; by < TEX_SIZE; by += 2) {
      for (let bx = 0; bx < TEX_SIZE; bx += 2) {
        const r = rng.next();
        const v = r < 0.18 ? 252 : r < 0.42 ? 170 : 215;
        for (let y = by; y < by + 2; y++) for (let x = bx; x < bx + 2; x++) set(x, y, v + rng.int(-6, 6));
      }
    }
  },

  bark: (set, rng) =>
    each((x, y) => {
      let v = 205 + rng.int(0, 25);
      if (x % 4 === 0) v = 150 + rng.int(0, 15);
      if (rng.chance(0.05)) v = 130;
      set(x, y, v);
    }),

  rock: (set, rng) => {
    for (let by = 0; by < TEX_SIZE; by += 2) {
      for (let bx = 0; bx < TEX_SIZE; bx += 2) {
        const v = 195 + rng.int(0, 50);
        for (let y = by; y < by + 2; y++) for (let x = bx; x < bx + 2; x++) set(x, y, v);
      }
    }
    for (let i = 0; i < 3; i++) {
      let x = rng.int(0, 15);
      for (let y = rng.int(0, 8); y < TEX_SIZE; y++) {
        set(x, y, 140);
        if (rng.chance(0.4)) x = (x + (rng.chance(0.5) ? 1 : 15)) % TEX_SIZE;
        if (rng.chance(0.25)) break;
      }
    }
  },

  soil: (set, rng) =>
    each((x, y) => {
      let v = 205 + rng.int(0, 22);
      if (y % 4 === 3) v = 145;
      else if (y % 4 === 0) v = 236;
      set(x, y, v);
    }),

  cloth: (set, rng) => each((x, y) => set(x, y, ((x + y) % 2 === 0 ? 246 : 228) + rng.int(0, 6))),

  water: (set, rng) => {
    each((x, y) => set(x, y, 222 + rng.int(0, 10)));
    for (let i = 0; i < 5; i++) {
      const x0 = rng.int(0, 15);
      const y0 = rng.int(0, 15);
      const len = rng.int(3, 5);
      for (let k = 0; k < len; k++) set((x0 + k) % TEX_SIZE, y0, 255);
    }
  },
};

const cache = new Map<TexKey, THREE.CanvasTexture>();

export function pixelTexture(key: TexKey): THREE.CanvasTexture {
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available.');
  const image = ctx.createImageData(TEX_SIZE, TEX_SIZE);
  const rng = new Rng(hashKey(key));
  PAINTERS[key]((x, y, v) => {
    const i = (y * TEX_SIZE + x) * 4;
    const c = Math.max(0, Math.min(255, Math.round(v)));
    image.data[i] = c;
    image.data[i + 1] = c;
    image.data[i + 2] = c;
    image.data[i + 3] = 255;
  }, rng);
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter; // crisp pixels up close
  texture.minFilter = THREE.LinearMipmapLinearFilter; // no shimmering far away
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  cache.set(key, texture);
  return texture;
}

function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}
