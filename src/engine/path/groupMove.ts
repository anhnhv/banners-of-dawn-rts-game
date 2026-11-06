/**
 * Group moves (PLAN §5.5): give every unit of a group its own destination slot around the
 * clicked point, so a group arrives as a tidy blob instead of fighting over one spot.
 */
import type { Grid } from '../map/Grid';
import type { Point } from './smoothing';

/** Nearest passable tile center to (x, y), searching outward up to `maxRadius` tiles. */
export function nearestPassable(grid: Grid, x: number, y: number, maxRadius = 12): Point | null {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (grid.isPassable(tx, ty)) return { x, y };
  let best: Point | null = null;
  let bestD = Infinity;
  for (let r = 1; r <= maxRadius; r++) {
    for (let j = ty - r; j <= ty + r; j++) {
      for (let i = tx - r; i <= tx + r; i++) {
        if (Math.max(Math.abs(i - tx), Math.abs(j - ty)) !== r || !grid.isPassable(i, j)) continue;
        const cx = i + 0.5;
        const cy = j + 0.5;
        const d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { x: cx, y: cy };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * `count` distinct passable slots around `center`, spaced `spacing` apart, nearest first.
 * Slots fill rings of a square spiral around the center.
 */
export function formationSlots(grid: Grid, center: Point, count: number, spacing = 0.75): Point[] {
  const origin = nearestPassable(grid, center.x, center.y) ?? center;
  const slots: Point[] = [];
  const taken = new Set<string>();
  for (let ring = 0; slots.length < count && ring < 40; ring++) {
    const candidates: Point[] = [];
    for (let j = -ring; j <= ring; j++) {
      for (let i = -ring; i <= ring; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        candidates.push({ x: origin.x + i * spacing, y: origin.y + j * spacing });
      }
    }
    candidates.sort((a, b) => dist2(a, origin) - dist2(b, origin) || a.y - b.y || a.x - b.x);
    for (const c of candidates) {
      if (slots.length >= count) break;
      const key = `${Math.round(c.x * 100)},${Math.round(c.y * 100)}`;
      if (taken.has(key) || !grid.isPassable(Math.floor(c.x), Math.floor(c.y))) continue;
      taken.add(key);
      slots.push(c);
    }
  }
  return slots;
}

/**
 * Assign each unit a slot. Greedy and deterministic: units farthest from the target choose first,
 * each taking its nearest free slot. Returns slot index per unit (same order as `units`).
 */
export function assignSlots(units: readonly Point[], slots: readonly Point[], target: Point): number[] {
  const order = units
    .map((_, i) => i)
    .sort((a, b) => dist2(units[b] as Point, target) - dist2(units[a] as Point, target) || a - b);
  const free = new Set(slots.map((_, i) => i));
  const result = new Array<number>(units.length).fill(-1);
  for (const u of order) {
    let best = -1;
    let bestD = Infinity;
    for (const s of free) {
      const d = dist2(units[u] as Point, slots[s] as Point);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (best >= 0) {
      free.delete(best);
      result[u] = best;
    }
  }
  return result;
}

function dist2(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}
