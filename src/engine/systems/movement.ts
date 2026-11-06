/**
 * Movement systems (PLAN §5.3 steps 5–7). Orders decide WHERE a unit should go by setting its
 * `goal` (setGoal); these systems find the path (budgeted), walk it with stuck detection, and keep
 * units apart. When the goal is reached `arrived` is set; the order system reacts next tick.
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

/** Send the unit toward `p` (no-op if it is already heading there). */
export function setGoal(state: GameState, u: Unit, p: Point): void {
  if (u.goal && Math.abs(u.goal.x - p.x) < 0.01 && Math.abs(u.goal.y - p.y) < 0.01) return;
  u.goal = { x: p.x, y: p.y };
  u.arrived = false;
  u.blocked = false;
  u.repaths = 0;
  clearPath(u);
  requestPath(state, u);
}

/** Stop moving and forget the goal. */
export function clearGoal(u: Unit): void {
  u.goal = null;
  u.arrived = false;
  u.blocked = false;
  u.pathPending = false;
  clearPath(u);
}

function requestPath(state: GameState, u: Unit): void {
  u.pathPending = true;
  state.pathQueue.push(u.id);
}

function arrive(u: Unit, blocked: boolean): void {
  clearPath(u);
  u.arrived = true;
  u.blocked = blocked;
}

/** Answer path requests until the node budget for this tick is used up. */
export function pathfindingSystem(state: GameState): void {
  let budget = PATH_BUDGET_PER_TICK;
  while (budget > 0 && state.pathQueue.length > 0) {
    const id = state.pathQueue.shift() as number;
    const u = state.units.get(id);
    if (!u || !u.pathPending || !u.goal) continue;
    u.pathPending = false;
    budget -= computePath(state, u, u.goal);
  }
}

function computePath(state: GameState, u: Unit, target: Point): number {
  const { grid } = state;
  const goal = nearestPassable(grid, target.x, target.y);
  if (!goal) {
    arrive(u, true);
    return 1;
  }
  const result = state.pathFinder.find(
    Math.floor(u.x),
    Math.floor(u.y),
    Math.floor(goal.x),
    Math.floor(goal.y),
  );
  if (result.tiles.length === 0) {
    arrive(u, true);
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

/** Follow the path; detect being stuck and ask for a new path. */
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
      arrive(u, false);
      continue;
    }
    const dx = wp.x - u.x;
    const dy = wp.y - u.y;
    const dist = Math.hypot(dx, dy);
    const isLast = u.pathIndex === path.length - 1;
    const tx = Math.floor(u.x);
    const ty = Math.floor(u.y);
    const terrain = grid.inBounds(tx, ty) ? grid.rule(tx, ty).speed : 1;
    const step = (u.speed * (terrain > 0 ? terrain : 1)) / TICK_RATE;

    if (dist <= Math.max(step, ARRIVE_EPSILON)) {
      u.x = wp.x;
      u.y = wp.y;
      u.pathIndex++;
      u.bestDist = Infinity;
      u.stuckTicks = 0;
      if (isLast) arrive(u, false);
      else u.moving = true;
      continue;
    }

    u.x += (dx / dist) * step;
    u.y += (dy / dist) * step;
    u.facing = Math.atan2(dx, dy);
    u.moving = true;

    if (dist < u.bestDist - 0.01) {
      u.bestDist = dist;
      u.stuckTicks = 0;
    } else if (++u.stuckTicks > STUCK_TICKS) {
      if (isLast && dist < 1.0) {
        arrive(u, false); // crowded at the destination: close enough
      } else if (u.repaths >= MAX_REPATHS) {
        arrive(u, true);
      } else {
        u.repaths++;
        clearPath(u);
        requestPath(state, u);
      }
    }
  }
}

/**
 * Soft separation. Overlapping units push each other apart; units standing still yield more than
 * moving ones so groups can pass through idle units. Never pushes into blocked tiles.
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
        const angle = ((a.id * 7919 + b.id * 104729) % 360) * (Math.PI / 180);
        nx = Math.cos(angle);
        ny = Math.sin(angle);
        d = 0;
      } else {
        nx = dx / d;
        ny = dy / d;
      }
      const overlap = (min - d) * 0.5;
      // working units hold their spot; moving units yield to nobody but working ones
      const weight = (u: typeof a): number => (u.activity === 'work' ? 0.1 : u.moving ? 0.3 : 1);
      const wa = weight(a);
      const wb = weight(b);
      const aShare = wa / (wa + wb);
      const bShare = 1 - aShare;
      pushX.set(a.id, (pushX.get(a.id) ?? 0) - nx * overlap * aShare);
      pushY.set(a.id, (pushY.get(a.id) ?? 0) - ny * overlap * aShare);
      pushX.set(b.id, (pushX.get(b.id) ?? 0) + nx * overlap * bShare);
      pushY.set(b.id, (pushY.get(b.id) ?? 0) + ny * overlap * bShare);
    });
  }

  for (const [id, px] of pushX) {
    const u = state.units.get(id);
    if (!u) continue;
    const py = pushY.get(id) ?? 0;
    const max = 0.08;
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
