/**
 * Path smoothing (PLAN §5.5): remove waypoints that can be skipped because the straight line
 * between two points only crosses passable tiles (with no corner squeezing).
 */
import type { Grid } from '../map/Grid';

export interface Point {
  x: number;
  y: number;
}

/**
 * True if a unit can walk in a straight line from a to b (grid space, tile units).
 * Walks every tile the segment touches; when the segment passes exactly through a tile corner,
 * both side tiles must be free (so units never slip diagonally between two blocked tiles).
 */
export function lineOfSight(grid: Grid, a: Point, b: Point): boolean {
  let x = Math.floor(a.x);
  let y = Math.floor(a.y);
  const endX = Math.floor(b.x);
  const endY = Math.floor(b.y);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tMaxX = dx !== 0 ? (dx > 0 ? x + 1 - a.x : a.x - x) * tDeltaX : Infinity;
  let tMaxY = dy !== 0 ? (dy > 0 ? y + 1 - a.y : a.y - y) * tDeltaY : Infinity;

  if (!grid.isPassable(x, y)) return false;
  let guard = 0;
  while ((x !== endX || y !== endY) && guard++ < 4096) {
    if (Math.abs(tMaxX - tMaxY) < 1e-9) {
      // passing through a corner: both neighbours must be free
      if (!grid.isPassable(x + stepX, y) || !grid.isPassable(x, y + stepY)) return false;
      x += stepX;
      y += stepY;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    } else if (tMaxX < tMaxY) {
      x += stepX;
      tMaxX += tDeltaX;
    } else {
      y += stepY;
      tMaxY += tDeltaY;
    }
    if (!grid.isPassable(x, y)) return false;
  }
  return true;
}

/** Greedy string pulling: keep only the waypoints needed to stay on passable tiles. */
export function smoothPath(grid: Grid, points: readonly Point[]): Point[] {
  if (points.length <= 2) return [...points];
  const out: Point[] = [];
  let anchor = 0;
  out.push(points[0] as Point);
  while (anchor < points.length - 1) {
    let next = anchor + 1;
    for (let j = points.length - 1; j > anchor + 1; j--) {
      if (lineOfSight(grid, points[anchor] as Point, points[j] as Point)) {
        next = j;
        break;
      }
    }
    out.push(points[next] as Point);
    anchor = next;
  }
  return out;
}
