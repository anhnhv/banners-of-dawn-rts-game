/**
 * Movement systems (PLAN §5.3 steps 5–7). Orders decide WHERE a unit should go by setting its
 * `goal` (setGoal); these systems find the path (budgeted, around standing units), walk it with
 * stuck detection while stepping around any unit in the way (never through it, never pushing it,
 * never asking it to move), and keep units apart.
 * When the goal is reached `arrived` is set; the order system reacts next tick.
 */
import { TICK_RATE } from '../../shared';
import { clearPath, type Unit } from '../entities/Unit';
import type { GameState } from '../GameState';
import { nearestPassable } from '../path/groupMove';
import { lineOfSight, smoothPath, type Point } from '../path/smoothing';

/** Max A* nodes expanded per tick across all requests. */
export const PATH_BUDGET_PER_TICK = 20000;
/** Ticks without progress before a unit asks for a new path. */
const STUCK_TICKS = 24;
const MAX_REPATHS = 3;
/** Stuck among walking units (traffic that will clear): keep asking for new paths up to this many times. */
const MAX_REPATHS_IN_TRAFFIC = 10;
const ARRIVE_EPSILON = 0.02;
/** Room kept between two units when one walks past the other (tiles). */
const UNIT_GAP = 0.03;
/** Turns tried (degrees off the wanted direction) to step around a unit in the way. */
const STEER_ANGLES = [20, 40, 60, 80, 100];
/** Extra A* cost of a tile where a unit stands (straight steps): walk around it if there is room. */
const UNIT_TILE_COST = 4;
/** The same after getting stuck: a real detour beats waiting behind units that will not move. */
const STUCK_UNIT_TILE_COST = 24;
/** Distance (tiles) from a waypoint at which a unit may head for the next one if it is in sight. */
const WAYPOINT_SKIP = 0.9;
/** On the last leg, a walker this close to a full goal (tiles) counts as arrived. */
const CROWD_ARRIVE = 3;
/** Standing units around the goal (within GOAL_CROWD_RADIUS) that make it "full". */
const GOAL_CROWD_COUNT = 3;
const GOAL_CROWD_RADIUS = 1.25;
/** While going around a unit, how far ahead (tiles) the straight way must be clear to take it again. */
const STEER_LOOKAHEAD = 0.5;
/** Ticks the chosen side is kept after the way ahead clears (so the next blocker is passed the same way). */
const AVOID_HOLD_TICKS = 8;
/** Waiting behind a standing unit (it will not make room) counts this many times faster as stuck. */
const STANDING_STUCK_RATE = 4;

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

/**
 * A unit standing still: no path to walk and none on the way. Walkers go around standing units;
 * they never push them aside.
 */
export function isStanding(u: Unit): boolean {
  return !u.path && !u.pathPending;
}

/** Answer path requests until the node budget for this tick is used up. */
export function pathfindingSystem(state: GameState): void {
  let budget = PATH_BUDGET_PER_TICK;
  let standing: Set<number> | null = null;
  while (budget > 0 && state.pathQueue.length > 0) {
    const id = state.pathQueue.shift() as number;
    const u = state.units.get(id);
    if (!u || !u.pathPending || !u.goal) continue;
    standing ??= standingTiles(state, state.units.values());
    u.pathPending = false;
    budget -= computePath(state, u, u.goal, standing);
  }
}

/** Tiles covered by the given units (those that are standing, unless `all`). */
function standingTiles(
  state: GameState,
  units: Iterable<Unit>,
  all = false,
  into = new Set<number>(),
): Set<number> {
  const { grid } = state;
  for (const o of units) {
    if (!all && !isStanding(o)) continue;
    const x0 = Math.floor(o.x - o.radius);
    const x1 = Math.floor(o.x + o.radius);
    const y0 = Math.floor(o.y - o.radius);
    const y1 = Math.floor(o.y + o.radius);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) if (grid.inBounds(x, y)) into.add(grid.index(x, y));
  }
  return into;
}

function computePath(state: GameState, u: Unit, target: Point, standing: ReadonlySet<number>): number {
  const { grid } = state;
  const goal = nearestPassable(grid, target.x, target.y);
  if (!goal) {
    arrive(u, true);
    return 1;
  }
  const sx = Math.floor(u.x);
  const sy = Math.floor(u.y);
  const gx = Math.floor(goal.x);
  const gy = Math.floor(goal.y);
  // after getting stuck, also walk around the units right next to it (walkers included)
  let avoid = standing;
  if (u.repaths > 0) {
    const near: Unit[] = [];
    state.spatial.forEachNear(u.x, u.y, 2, (o) => {
      if (o !== u) near.push(o);
    });
    avoid = standingTiles(state, near, true, new Set(standing));
  }
  const startTile = grid.inBounds(sx, sy) ? grid.index(sx, sy) : -1;
  const goalTile = grid.index(gx, gy);
  const result = state.pathFinder.find(sx, sy, gx, gy, {
    avoid,
    avoidCost: u.repaths > 0 ? STUCK_UNIT_TILE_COST : UNIT_TILE_COST,
  });
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
  const avoided = (x: number, y: number): boolean => {
    const i = grid.index(x, y);
    return i !== startTile && i !== goalTile && avoid.has(i);
  };
  u.path = smoothPath(grid, points, avoid.size > 0 ? avoided : undefined);
  u.pathIndex = 1;
  u.bestDist = Infinity;
  u.stuckTicks = 0;
  u.avoidSide = 0;
  return result.expanded + 1;
}

/**
 * Follow the path; detect being stuck and ask for a new path. A unit never walks into another
 * unit: when one is in the way it steps around it (keeping to one side), and when there is no
 * room on either side it waits. Waiting too long counts as stuck and asks for a new path that
 * goes around the units in the way.
 */
export function movementSystem(state: GameState): void {
  const { grid, spatial } = state;
  spatial.clear();
  for (const u of state.units.values()) spatial.insert(u);
  let standingNow: StandingAvoid | null = null;
  for (const u of state.units.values()) {
    const path = u.path;
    if (!path) {
      u.moving = false;
      continue;
    }
    // a crowd cannot all pass through the exact same corner point: once the next waypoint is in
    // clear sight from nearby (not cutting across a standing unit), head for it in the same tick
    const next = path[u.pathIndex + 1];
    const cur = path[u.pathIndex];
    if (
      cur &&
      next &&
      Math.hypot(cur.x - u.x, cur.y - u.y) < WAYPOINT_SKIP &&
      lineOfSight(grid, u, next, (standingNow ??= standingAvoid(state)).blocks(u, path))
    ) {
      u.pathIndex++;
      u.bestDist = Infinity;
      u.stuckTicks = 0;
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

    if (dist <= Math.max(step, ARRIVE_EPSILON) && !unitInTheWay(state, u, wp.x, wp.y)) {
      u.x = wp.x;
      u.y = wp.y;
      u.pathIndex++;
      u.bestDist = Infinity;
      u.stuckTicks = 0;
      if (isLast) arrive(u, false);
      else u.moving = true;
      continue;
    }

    const dir = dist > 1e-9 ? steer(state, u, dx / dist, dy / dist, Math.min(step, dist)) : null;
    let crowded = false;
    if (dir) {
      const s = Math.min(step, dist);
      u.x += dir.x * s;
      u.y += dir.y * s;
      u.facing = Math.atan2(dir.x, dir.y);
      u.moving = true;
    } else {
      u.moving = false; // waiting for room
      const inTheWay = unitInTheWay(state, u, u.x + (dx / dist) * step, u.y + (dy / dist) * step);
      crowded = !!inTheWay && isStanding(inTheWay);
    }

    const now = Math.hypot(wp.x - u.x, wp.y - u.y);
    if (now < u.bestDist - 0.01) {
      u.bestDist = now;
      u.stuckTicks = 0;
    } else if ((u.stuckTicks += crowded ? STANDING_STUCK_RATE : 1) > STUCK_TICKS) {
      if (isLast && (now < 1.0 || (crowded && now < CROWD_ARRIVE && goalIsFull(state, u, wp)))) {
        arrive(u, false); // the destination is full (others stand on and around it): close enough
      } else if (u.repaths >= (inTraffic(state, u) ? MAX_REPATHS_IN_TRAFFIC : MAX_REPATHS)) {
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
 * The direction `u` steps in this tick, starting from the wanted one (wx, wy): straight on when
 * nobody is in the way, otherwise the smallest turn to one side that is free (the side away from
 * the unit in the way), then the other side. Null when every direction is taken: wait.
 * While going around a unit, straight on is only taken again once it is clear a little further
 * ahead than one step (else the unit flips between straight and turning each tick and wobbles
 * along the other unit's edge), and the side is kept for a few ticks after that.
 */
function steer(state: GameState, u: Unit, wx: number, wy: number, step: number): Point | null {
  const probe = u.avoidSide !== 0 ? Math.max(step, STEER_LOOKAHEAD) : step;
  const ahead =
    unitInTheWay(state, u, u.x + wx * step, u.y + wy * step) ??
    (probe > step ? unitInTheWay(state, u, u.x + wx * probe, u.y + wy * probe) : null);
  if (!ahead) {
    if (u.avoidSide !== 0 && --u.avoidHold <= 0) u.avoidSide = 0;
    return { x: wx, y: wy };
  }
  if (u.avoidSide === 0) {
    // turn away from the unit in the way; head-on (exactly ahead) both turn the same way and pass
    const cross = wx * (ahead.y - u.y) - wy * (ahead.x - u.x);
    u.avoidSide = cross > 1e-6 ? -1 : 1;
  }
  u.avoidHold = AVOID_HOLD_TICKS;
  const { grid } = state;
  for (const side of [u.avoidSide, -u.avoidSide]) {
    for (const deg of STEER_ANGLES) {
      const a = side * deg * (Math.PI / 180);
      const c = Math.cos(a);
      const s = Math.sin(a);
      const rx = wx * c - wy * s;
      const ry = wx * s + wy * c;
      const nx = u.x + rx * step;
      const ny = u.y + ry * step;
      if (!grid.isPassable(Math.floor(nx), Math.floor(ny))) continue;
      if (unitInTheWay(state, u, nx, ny)) continue;
      if (side !== u.avoidSide) u.avoidSide = side;
      return { x: rx, y: ry };
    }
  }
  return null;
}

/**
 * The goal really is full: a standing unit covers it, or several standing units crowd around it.
 * One unit standing somewhere on the way in does not count (the walker keeps trying).
 */
function goalIsFull(state: GameState, u: Unit, goal: Point): boolean {
  let around = 0;
  let covered = false;
  state.spatial.forEachNear(goal.x, goal.y, GOAL_CROWD_RADIUS, (o) => {
    if (o === u || !isStanding(o)) return;
    const d = Math.hypot(o.x - goal.x, o.y - goal.y);
    if (d < u.radius + o.radius) covered = true;
    if (d < GOAL_CROWD_RADIUS) around++;
  });
  return covered || around >= GOAL_CROWD_COUNT;
}

/** Walking units right around `u`: the jam it is in will clear by itself, so it does not give up. */
function inTraffic(state: GameState, u: Unit): boolean {
  let found = false;
  state.spatial.forEachNear(u.x, u.y, 1.5, (o) => {
    if (o !== u && !isStanding(o)) found = true;
  });
  return found;
}

interface StandingAvoid {
  /** Tile test for lineOfSight: another unit stands there (not `u`'s own tile, not its goal tile). */
  blocks(u: Unit, path: Point[]): (x: number, y: number) => boolean;
}

/** Tiles where standing units are, built once per tick (only when a unit looks ahead). */
function standingAvoid(state: GameState): StandingAvoid {
  const { grid } = state;
  const tiles = standingTiles(state, state.units.values());
  const tileOf = (p: Point): number => {
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    return grid.inBounds(x, y) ? grid.index(x, y) : -1;
  };
  return {
    blocks(u, path) {
      const own = tileOf(u);
      const goal = tileOf(path[path.length - 1] ?? u);
      return (x, y) => {
        if (!grid.inBounds(x, y)) return false;
        const i = grid.index(x, y);
        return i !== own && i !== goal && tiles.has(i);
      };
    },
  };
}

/**
 * The nearest unit that `u` would touch by standing at (x, y) while getting closer to it, or
 * null. Moving away from a unit it already touches is always allowed.
 */
function unitInTheWay(state: GameState, u: Unit, x: number, y: number): Unit | null {
  let found: Unit | null = null;
  let foundD = Infinity;
  state.spatial.forEachNear(x, y, 1.5, (o) => {
    if (o === u) return;
    const min = u.radius + o.radius + UNIT_GAP;
    const d = Math.hypot(o.x - x, o.y - y);
    if (d >= min || d >= Math.hypot(o.x - u.x, o.y - u.y) - 1e-6) return;
    if (d < foundD) {
      foundD = d;
      found = o;
    }
  });
  return found;
}

/**
 * Soft separation, for units that still overlap (spawned on the same spot, squeezed at a goal).
 * Walkers never push a standing unit and nobody pushes a working one: the unit that is "more
 * settled" (working > standing > walking) holds its spot and the other one moves; equals share.
 * Never pushes into blocked tiles.
 */
export function separationSystem(state: GameState): void {
  const { spatial, grid } = state;
  spatial.clear();
  for (const u of state.units.values()) spatial.insert(u);
  const pushX = new Map<number, number>();
  const pushY = new Map<number, number>();
  const rank = (u: Unit): number => (u.activity === 'work' ? 2 : isStanding(u) ? 1 : 0);

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
      const ra = rank(a);
      const rb = rank(b);
      const aShare = ra === rb ? 0.5 : ra > rb ? 0 : 1;
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
