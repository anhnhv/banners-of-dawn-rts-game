/** Geometry helpers for interacting with entities that have a footprint (nodes, buildings). */
import type { Rect } from '../entities/Building';
import type { Unit } from '../entities/Unit';
import type { Grid } from '../map/Grid';
import type { Point } from '../path/smoothing';

/** Distance from a point to the nearest point of a rectangle (0 if inside). */
export function distanceToRect(x: number, y: number, r: Rect): number {
  const cx = Math.max(r.x, Math.min(r.x + r.w, x));
  const cy = Math.max(r.y, Math.min(r.y + r.h, y));
  return Math.hypot(x - cx, y - cy);
}

/** Close enough to work on / drop off at the rectangle. */
export function inReach(u: Unit, r: Rect, reach: number): boolean {
  return distanceToRect(u.x, u.y, r) <= u.radius + reach;
}

/**
 * Where to stand to reach a rectangle: the passable tile around it nearest to `from`.
 * Returns null when the rectangle is completely enclosed (e.g. a tree deep inside a forest).
 */
export function approachPoint(grid: Grid, r: Rect, from: Point): Point | null {
  let best: Point | null = null;
  let bestD = Infinity;
  for (let y = r.y - 1; y <= r.y + r.h; y++) {
    for (let x = r.x - 1; x <= r.x + r.w; x++) {
      const inside = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
      if (inside || !grid.isPassable(x, y)) continue;
      // stand at the tile center, nudged toward the target so the unit is well within reach
      const cx = x + 0.5 + Math.sign(r.x + r.w / 2 - (x + 0.5)) * (x < r.x || x >= r.x + r.w ? 0.2 : 0);
      const cy = y + 0.5 + Math.sign(r.y + r.h / 2 - (y + 0.5)) * (y < r.y || y >= r.y + r.h ? 0.2 : 0);
      const d = Math.hypot(cx - from.x, cy - from.y);
      if (d < bestD) {
        bestD = d;
        best = { x: cx, y: cy };
      }
    }
  }
  return best;
}
