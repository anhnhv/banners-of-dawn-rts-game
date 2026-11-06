/**
 * Screen-space unit picking (PLAN §7.5). Pure functions over units already projected to the
 * screen, so they are easy to test without a renderer.
 */
import type { EntityId, PlayerId, UnitTypeId } from '../../shared';

export interface ScreenUnit {
  id: EntityId;
  owner: PlayerId;
  type: UnitTypeId;
  /** Body center on screen (px). */
  sx: number;
  sy: number;
  /** Feet on screen (px), used for box selection. */
  fx: number;
  fy: number;
  /** Click tolerance around the body center (px). */
  pickRadius: number;
}

/** The unit under the cursor: own units win over enemy units, then the nearest one. */
export function pickAt(
  units: readonly ScreenUnit[],
  x: number,
  y: number,
  player: PlayerId,
): ScreenUnit | null {
  let best: ScreenUnit | null = null;
  let bestScore = Infinity;
  for (const u of units) {
    const d = Math.hypot(u.sx - x, u.sy - y);
    if (d > u.pickRadius) continue;
    const score = d + (u.owner === player ? 0 : 1000);
    if (score < bestScore) {
      bestScore = score;
      best = u;
    }
  }
  return best;
}

/** Own units whose feet are inside the rectangle (any corner order). */
export function unitsInRect(
  units: readonly ScreenUnit[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  player: PlayerId,
): EntityId[] {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  return units
    .filter((u) => u.owner === player && u.fx >= minX && u.fx <= maxX && u.fy >= minY && u.fy <= maxY)
    .map((u) => u.id);
}

/** Own units of a given type that are visible inside the viewport rectangle. */
export function sameTypeOnScreen(
  units: readonly ScreenUnit[],
  type: UnitTypeId,
  player: PlayerId,
  width: number,
  height: number,
): EntityId[] {
  return unitsInRect(
    units.filter((u) => u.type === type),
    0,
    0,
    width,
    height,
    player,
  );
}
