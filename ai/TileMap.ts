/**
 * The AI's picture of where it may build: static terrain and rocks from StaticMapInfo, plus every
 * building and resource node in the latest observation, plus spots it has just asked for.
 * A spot needs a free 1-tile walkable ring around the footprint, so the AI never walls itself in.
 */
import type { Observation, StaticMapInfo } from '../src/shared';
import type { Point } from './situation';

export type Side = 'front' | 'back' | 'any';

export interface SpotQuery {
  w: number;
  h: number;
  around: Point;
  /** Unit vector toward the enemy. */
  front: Point;
  side: Side;
  /** Preferred distance from `around` to the footprint center, and the search limit. */
  near: number;
  far: number;
}

export class TileMap {
  private readonly occupied: Uint8Array;

  constructor(private readonly info: StaticMapInfo) {
    this.occupied = new Uint8Array(info.width * info.height);
  }

  update(obs: Observation, reserved: ReadonlyArray<{ x: number; y: number; w: number; h: number }>): void {
    this.occupied.fill(0);
    for (const r of [...obs.buildings, ...obs.nodes, ...reserved]) this.mark(r.x, r.y, r.w, r.h);
  }

  /** Best top-left tile for a footprint, or null. `exclude` = spots that were rejected. */
  findSpot(q: SpotQuery, exclude: ReadonlySet<string> = new Set()): Point | null {
    let best: Point | null = null;
    let bestScore = Infinity;
    const r = Math.ceil(q.far);
    const cx = Math.floor(q.around.x);
    const cy = Math.floor(q.around.y);
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (exclude.has(`${x},${y}`) || !this.fits(x, y, q.w, q.h)) continue;
        const mx = x + q.w / 2 - q.around.x;
        const my = y + q.h / 2 - q.around.y;
        const d = Math.hypot(mx, my);
        if (d > q.far || d < 2) continue;
        const toward = d > 0 ? (mx * q.front.x + my * q.front.y) / d : 0; // -1 back … 1 front
        const side = q.side === 'front' ? (1 - toward) * 3 : q.side === 'back' ? (1 + toward) * 3 : 0;
        const score = Math.abs(d - q.near) + side;
        if (score < bestScore - 1e-9) {
          best = { x, y };
          bestScore = score;
        }
      }
    }
    return best;
  }

  /** Footprint buildable and free, with a walkable free ring of one tile around it. */
  fits(x: number, y: number, w: number, h: number): boolean {
    const { width, height, buildable, passable } = this.info;
    for (let j = y - 1; j <= y + h; j++) {
      for (let i = x - 1; i <= x + w; i++) {
        if (i < 0 || j < 0 || i >= width || j >= height) return false;
        const k = j * width + i;
        if (this.occupied[k]) return false;
        const inside = i >= x && i < x + w && j >= y && j < y + h;
        if (inside ? !buildable[k] : !passable[k]) return false;
      }
    }
    return true;
  }

  private mark(x: number, y: number, w: number, h: number): void {
    const { width, height } = this.info;
    for (let j = Math.max(0, y); j < Math.min(height, y + h); j++)
      for (let i = Math.max(0, x); i < Math.min(width, x + w); i++) this.occupied[j * width + i] = 1;
  }
}
