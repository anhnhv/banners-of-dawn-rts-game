/**
 * Movement-related systems (PLAN §5.3 steps 4–7): orders → path requests, budgeted pathfinding,
 * path following with stuck detection, and soft separation between units.
 */
import { TICK_RATE } from '../../shared';
import { clearPath, type Unit } from '../entities/Unit';
import type { GameState } from '../GameState';
import { nearestPassable } from '../path/groupMove';
import { smoothPath, type Point } from '../path/smoothing';

/** Max A* nodes expanded per tick across all requests. */
export const PATH_BUDGET_PER_TICK = 20000;
/** Ticks without progress before a unit asks for a new path. */
const STUCK_TICKS = 24;
const MAX_REPATHS = 3;
const ARRIVE_EPSILON = 0.02;

/** Step 4: units with a move order but no path ask for one. */
export function orderSystem(state: GameState): void {
  for (const u of state.units.values()) {
    const order = u.orders[0];
    if (!order) {
      u.moving = false;
      continue;
    }
    if (order.kind === 'move' && !u.path && !u.pathPending) requestPath(state, u);
  }
}

export function requestPath(state: GameState, u: Unit): void {
  u.pathPending = true;
  state.pathQueue.push(u.id);
}

/** Step 5: answer path requests until the node budget for this tick is used up. */
export function pathfindingSystem(state: GameState): void {
  let budget = PATH_BUDGET_PER_TICK;
  while (budget > 0 && state.pathQueue.length > 0) {
    const id = state.pathQueue.shift() as number;
    const u = state.units.get(id);
    if (!u || !u.pathPending) continue;
    u.pathPending = false;
    const order = u.orders[0];
    if (!order || order.kind !== 'move') continue;
    budget -= computePath(state, u, order);
  }
}

function computePath(state: GameState, u: Unit, target: Point): number {
  const { grid } = state;
  const goal = nearestPassable(grid, target.x, target.y);
  if (!goal) {
    finishOrder(u);
    return 1;
  }
  const result = state.pathFinder.find(
    Math.floor(u.x),
    Math.floor(u.y),
    Math.floor(goal.x),
    Math.floor(goal.y),
  );
  if (result.tiles.length === 0) {
    finishOrder(u);
    return result.expanded + 1;
  }
  const points: Point[] = result.tiles.map((i) => ({
    x: (i % grid.width) + 0.5,
    y: Math.floor(i / grid.width) + 0.5,
  }));
  points[0] = { x: u.x, y: u.y };
  if (result.reachedGoal) points[points.length - 1] = goal;
  if (points.length === 1) points.push(result.reachedGoal ? goal : { x: u.x, y: u.y });
  u.path = smoothPath(grid, points);
  u.pathIndex = 1;
  u.bestDist = Infinity;
  u.stuckTicks = 0;
  return result.expanded + 1;
}

function finishOrder(u: Unit): void {
  u.orders.shift();
  clearPath(u);
  u.repaths = 0;
}

/** Step 6: follow the path; detect being stuck and ask for a new path. */
export function movementSystem(state: GameState): void {
  const { grid } = state;
  for (const u of state.units.values()) {
    const path = u.path;
    if (!path) {
      u.moving = false;
      continue;
    }
    const wp = path[u.pathIndex];
    if (!wp) {
      finishOrder(u);
      continue;
    }
    const dx = wp.x - u.x;
    const dy = wp.y - u.y;
    const dist = Math.hypot(dx, dy);
    const isLast = u.pathIndex === path.length - 1;
    const tile = grid.inBounds(Math.floor(u.x), Math.floor(u.y))
      ? grid.rule(Math.floor(u.x), Math.floor(u.y))
      : null;
    const step = (u.speed * (tile && tile.speed > 0 ? tile.speed : 1)) / TICK_RATE;

    if (dist <= Math.max(step, ARRIVE_EPSILON)) {
      u.x = wp.x;
      u.y = wp.y;
      u.pathIndex++;
      u.bestDist = Infinity;
      u.stuckTicks = 0;
      if (isLast) finishOrder(u);
      else u.moving = true;
      continue;
    }

    u.x += (dx / dist) * step;
    u.y += (dy / dist) * step;
    u.facing = Math.atan2(dx, dy);
    u.moving = true;

    // Stuck detection: no real progress toward the waypoint for a while.
    if (dist < u.bestDist - 0.01) {
      u.bestDist = dist;
      u.stuckTicks = 0;
    } else if (++u.stuckTicks > STUCK_TICKS) {
      // Crowded at the destination: close enough counts as arrived.
      if (isLast && dist < 1.0) {
        finishOrder(u);
      } else if (u.repaths >= MAX_REPATHS) {
        finishOrder(u);
      } else {
        u.repaths++;
        clearPath(u);
        requestPath(state, u);
      }
    }
  }
}

/**
 * Step 7: soft separation. Overlapping units push each other apart; units standing still yield
 * more than moving ones so groups can pass through idle units. Never pushes into blocked tiles.
 */
export function separationSystem(state: GameState): void {
  const { spatial, grid } = state;
  spatial.clear();
  for (const u of state.units.values()) spatial.insert(u);
  const pushX = new Map<number, number>();
  const pushY = new Map<number, number>();

  for (const a of state.units.values()) {
    spatial.forEachNear(a.x, a.y, 1, (b) => {
      if (b.id <= a.id) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) return;
      let d = Math.sqrt(d2);
      let nx: number;
      let ny: number;
      if (d < 1e-6) {
        // exactly on top of each other: deterministic direction from the ids
        const angle = ((a.id * 7919 + b.id * 104729) % 360) * (Math.PI / 180);
        nx = Math.cos(angle);
        ny = Math.sin(angle);
        d = 0;
      } else {
        nx = dx / d;
        ny = dy / d;
      }
      const overlap = (min - d) * 0.5;
      const aWeight = a.moving === b.moving ? 0.5 : a.moving ? 0.2 : 0.8;
      const bWeight = 1 - aWeight;
      pushX.set(a.id, (pushX.get(a.id) ?? 0) - nx * overlap * aWeight);
      pushY.set(a.id, (pushY.get(a.id) ?? 0) - ny * overlap * aWeight);
      pushX.set(b.id, (pushX.get(b.id) ?? 0) + nx * overlap * bWeight);
      pushY.set(b.id, (pushY.get(b.id) ?? 0) + ny * overlap * bWeight);
    });
  }

  for (const [id, px] of pushX) {
    const u = state.units.get(id);
    if (!u) continue;
    const py = pushY.get(id) ?? 0;
    const max = 0.08; // per tick, keeps it smooth
    const sx = Math.max(-max, Math.min(max, px));
    const sy = Math.max(-max, Math.min(max, py));
    const nx = clamp(u.x + sx, u.radius, grid.width - u.radius);
    const ny = clamp(u.y + sy, u.radius, grid.height - u.radius);
    if (grid.isPassable(Math.floor(nx), Math.floor(ny))) {
      u.x = nx;
      u.y = ny;
    } else if (grid.isPassable(Math.floor(nx), Math.floor(u.y))) {
      u.x = nx;
    } else if (grid.isPassable(Math.floor(u.x), Math.floor(ny))) {
      u.y = ny;
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
