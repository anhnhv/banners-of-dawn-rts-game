/**
 * Order system (PLAN §5.3 step 4, §5.4): runs each unit's current order as a small state machine
 * and sets the unit's movement goal. Gather rates come from units.json → interactions.gather.
 *
 *   move:     go there, then done
 *   gather:   toNode → harvest. Every whole unit harvested goes straight into the owner's stockpile
 *             (no carrying, no drop sites). The source is a node, or an own gather building such
 *             as a Farm (gatherSources.ts). When it runs out, is destroyed or is full, retarget the
 *             nearest source of the same resource within `retargetRadius`.
 *   attack:   chase → in range → strike whenever the cooldown allows → target dead: done.
 *             Auto-acquired attacks give up beyond `combat.leash` from where they started (and go
 *             back there, or resume the attack-move); hold-stance units never chase them.
 *   attackMove: walk there; the targeting system inserts attacks for enemies met on the way.
 */
import { TICK_RATE, type ResourceType } from '../../shared';
import { DATA } from '../data';
import type { Building, Rect, ResourceNode } from '../entities/Building';
import { gatherRate, type Order, type Unit } from '../entities/Unit';
import { claimSlot, hasFreeSlot, sourceFor, type GatherSource } from './gatherSources';
import type { GameState } from '../GameState';
import { attackOf, centerOf, combatant, gap, inAttackRange, isUnit, reachOf, strike } from './combat';
import { clearGoal, setGoal } from './movement';
import { approachPoint, inReach } from './reach';

const REACH = DATA.game.gathering.reach;

export function orderSystem(state: GameState): void {
  for (const u of state.units.values()) {
    u.activity = 'idle';
    const order = u.orders[0];
    // a worker that worked inside a building (a farmer on its field) first walks back out
    if (u.hp > 0 && !state.grid.isPassable(Math.floor(u.x), Math.floor(u.y)) && !worksInside(state, u)) {
      const field = fieldAround(state, u);
      if (field && walkOut(state, u, field)) continue;
    }
    if (!order) {
      if (u.goal) clearGoal(u);
      continue;
    }
    if (u.hp <= 0) continue;
    if (order.kind === 'move' || order.kind === 'attackMove') {
      setGoal(state, u, order);
      if (u.arrived) finish(u);
    } else if (order.kind === 'attack') {
      attack(state, u, order);
    } else {
      gather(state, u, order);
    }
  }
}

function finish(u: Unit): void {
  u.orders.shift();
  u.workProgress = 0;
  clearGoal(u);
}

function attack(state: GameState, u: Unit, o: Extract<Order, { kind: 'attack' }>): void {
  const target = combatant(state, o.target);
  const def = attackOf(u);
  if (!target || !def) {
    finish(u);
    return;
  }
  if (o.auto && Math.hypot(u.x - o.homeX, u.y - o.homeY) > DATA.game.combat.leash) {
    // leash: give up the chase; resume the attack-move, or walk back to where it started
    finish(u);
    if (u.orders[0]?.kind !== 'attackMove') u.orders = [{ kind: 'move', x: o.homeX, y: o.homeY }];
    return;
  }
  const c = centerOf(target);
  if (inAttackRange(u, target, def)) {
    clearGoal(u);
    u.activity = 'attack';
    u.facing = Math.atan2(c.x - u.x, c.y - u.y);
    if (u.cooldown <= 0) strike(state, u, target, def);
    return;
  }
  if (o.auto && u.stance === 'hold') {
    finish(u); // hold: never chase
    return;
  }
  const minRange = def.minRange ?? 0;
  if (minRange > 0 && gap(u, target) < minRange) {
    // too close for this weapon: step back
    const dx = u.x - c.x;
    const dy = u.y - c.y;
    const len = Math.hypot(dx, dy) || 1;
    const back = minRange + 0.5;
    setGoal(state, u, { x: c.x + (dx / len) * back, y: c.y + (dy / len) * back });
  } else if (isUnit(target)) {
    // chase; re-path only when the target has moved away from the current goal. A target standing
    // inside a building (a farmer on its field) is reached from the free tile next to it.
    const beside = state.grid.isPassable(Math.floor(target.x), Math.floor(target.y))
      ? null
      : besidePoint(state, target, u);
    if (beside) {
      if (!u.goal || Math.hypot(u.goal.x - beside.x, u.goal.y - beside.y) > 0.01) setGoal(state, u, beside);
    } else if (def.range > 0) {
      if (!u.goal || Math.hypot(u.goal.x - c.x, u.goal.y - c.y) > 0.75) setGoal(state, u, c);
    } else {
      // melee: its own free spot next to the target (units do not push each other out of the way)
      const ring = u.radius + target.radius + reachOf(def) * 0.5;
      if (!u.goal || Math.hypot(u.goal.x - c.x, u.goal.y - c.y) > ring + 0.75)
        setGoal(state, u, spotAround(state, u, target, ring));
    }
  } else if (!u.goal) {
    const spot = approachPoint(state.grid, target, u, spotTaken(state, u));
    if (!spot) {
      finish(u);
      return;
    }
    setGoal(state, u, spot);
  }
  if (u.arrived) {
    if (u.blocked)
      finish(u); // unreachable
    else clearGoal(u); // arrived but not in range yet (target moved): pick a new goal next tick
  }
}

function gather(state: GameState, u: Unit, o: Extract<Order, { kind: 'gather' }>): void {
  let src = sourceFor(state, o.target, u);
  if (!src) {
    // gone (depleted, destroyed) or no longer usable: the nearest other source of that resource
    src = findSource(state, u, o.resource, o.lastX, o.lastY, null);
    if (!src) {
      finish(u);
      return;
    }
    o.target = src.id;
    o.phase = 'toNode';
  }
  if (src.building && !claimSlot(src.building, u)) {
    // every slot of this building is taken (e.g. a farm already has its farmer): look elsewhere
    const other = findSource(state, u, o.resource, src.x + src.w / 2, src.y + src.h / 2, src.id);
    if (other) {
      o.target = other.id;
      o.phase = 'toNode';
    } else finish(u);
    return;
  }

  if (o.phase === 'toNode') {
    if (inReach(u, src, REACH)) {
      o.phase = 'harvest';
      clearGoal(u);
    } else {
      const spot = u.goal && !u.arrived ? u.goal : approachPoint(state.grid, src, u, spotTaken(state, u));
      if (!spot || (u.arrived && u.blocked)) {
        // this source cannot be reached: try another one of the same resource
        const other = findSource(state, u, o.resource, src.x, src.y, src.id);
        if (other) o.target = other.id;
        else finish(u);
        return;
      }
      setGoal(state, u, spot);
      if (u.arrived && !inReach(u, src, REACH)) clearGoal(u); // try again from here next tick
      return;
    }
  }

  // harvest
  if (!inReach(u, src, REACH)) {
    o.phase = 'toNode'; // pushed away
    return;
  }
  const spot = src.building ? workSpot(src.building, u) : null;
  if (spot && !walkStraight(u, spot)) return; // stepping onto the field
  u.activity = 'work';
  u.facing = Math.atan2(src.x + src.w / 2 - u.x, src.y + src.h / 2 - u.y);
  const player = state.players.get(u.owner);
  u.workProgress += (gatherRate(u.type, src.kind) * state.rules.gatherRate) / TICK_RATE;
  o.lastX = src.x;
  o.lastY = src.y;
  const node = src.building ? null : state.nodes.get(src.id);
  if (!node) {
    // a gather building never runs out
    while (u.workProgress >= 1) {
      u.workProgress -= 1;
      if (player) player.resources[src.resource] += 1;
    }
    return;
  }
  while (u.workProgress >= 1 && node.amount > 0) {
    u.workProgress -= 1;
    node.amount -= 1;
    if (player) player.resources[node.resource] += 1;
  }
  const view = state.nodeViews.get(node.id);
  if (view) view.amount = node.amount;
  if (node.amount <= 0) {
    depleteNode(state, node);
    o.phase = 'toNode';
  }
}

/** Move straight toward `p` at walking speed, ignoring the grid (in and out of a field). */
function walkStraight(u: Unit, p: { x: number; y: number }): boolean {
  const dx = p.x - u.x;
  const dy = p.y - u.y;
  const d = Math.hypot(dx, dy);
  const step = u.speed / TICK_RATE;
  if (d <= Math.max(step, 0.01)) {
    u.x = p.x;
    u.y = p.y;
    return true;
  }
  u.x += (dx / d) * step;
  u.y += (dy / d) * step;
  u.facing = Math.atan2(dx, dy);
  u.activity = 'walk';
  return false;
}

/**
 * Spots next to a target that another unit already uses: it stands there, or walks there. Units
 * do not push each other, so each attacker or gatherer picks its own spot around the target.
 */
function spotTaken(state: GameState, u: Unit): (p: { x: number; y: number }) => boolean {
  return (p) => {
    for (const o of state.units.values()) {
      if (o === u) continue;
      const g = o.goal && !o.arrived ? o.goal : null;
      if (g && Math.hypot(g.x - p.x, g.y - p.y) < 0.5) return true;
      if (Math.hypot(o.x - p.x, o.y - p.y) < u.radius + o.radius) return true;
    }
    return false;
  };
}

/**
 * A free spot on a circle of radius `ring` around unit `t`, the nearest one to `u` that is on
 * passable ground and not taken by another unit (standing there or heading there). The target's
 * center if every spot is taken.
 */
function spotAround(state: GameState, u: Unit, t: Unit, ring: number): { x: number; y: number } {
  const taken = spotTaken(state, u);
  const base = Math.atan2(u.y - t.y, u.x - t.x);
  const STEPS = 12;
  for (let k = 0; k <= STEPS / 2; k++) {
    for (const sign of k === 0 || k === STEPS / 2 ? [1] : [1, -1]) {
      const a = base + (sign * k * 2 * Math.PI) / STEPS;
      const p = { x: t.x + Math.cos(a) * ring, y: t.y + Math.sin(a) * ring };
      if (state.grid.isPassable(Math.floor(p.x), Math.floor(p.y)) && !taken(p)) return p;
    }
  }
  return { x: t.x, y: t.y };
}

/**
 * Where a worker of building `b` works: `gather.workInside` tiles inside the footprint, in from
 * the edge point nearest to the worker (null = it works from the edge).
 */
function workSpot(b: Building, u: Unit): { x: number; y: number } | null {
  const depth = DATA.buildings[b.type]?.gather?.workInside ?? 0;
  if (depth <= 0) return null;
  const inset = Math.min(depth, b.w / 2, b.h / 2);
  return {
    x: Math.max(b.x + inset, Math.min(b.x + b.w - inset, u.x)),
    y: Math.max(b.y + inset, Math.min(b.y + b.h - inset, u.y)),
  };
}

/** True while `u` is harvesting a building it works inside of, and stands within it. */
function worksInside(state: GameState, u: Unit): boolean {
  const o = u.orders[0];
  if (o?.kind !== 'gather' || o.phase !== 'harvest') return false;
  const b = state.buildings.get(o.target);
  if (!b || b.owner !== u.owner || !(DATA.buildings[b.type]?.gather?.workInside ?? 0)) return false;
  return u.x >= b.x && u.x <= b.x + b.w && u.y >= b.y && u.y <= b.y + b.h;
}

/**
 * Where `u` stands to reach `t`, a unit inside a building (a farmer on its field): just outside the
 * building edge nearest to `t`, straight across from it. Null if no such spot is free.
 */
function besidePoint(state: GameState, t: Unit, u: Unit): { x: number; y: number } | null {
  const b = [...state.buildings.values()].find(
    (r) => t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h,
  );
  if (!b) return null;
  const out = u.radius + 0.02;
  const sides = [
    { d: t.x - b.x, x: b.x - out, y: t.y },
    { d: b.x + b.w - t.x, x: b.x + b.w + out, y: t.y },
    { d: t.y - b.y, x: t.x, y: b.y - out },
    { d: b.y + b.h - t.y, x: t.x, y: b.y + b.h + out },
  ].sort((a, c) => a.d - c.d);
  for (const s of sides)
    if (state.grid.isPassable(Math.floor(s.x), Math.floor(s.y))) return { x: s.x, y: s.y };
  return null;
}

/**
 * The building with `gather.workInside` (a field) that `u` stands well inside of, or null. Other
 * units graze blocked tiles now and then (corners, water edges); only a field walks them out.
 */
function fieldAround(state: GameState, u: Unit): Building | null {
  const m = 0.05;
  for (const b of state.buildings.values()) {
    if (!(DATA.buildings[b.type]?.gather?.workInside ?? 0)) continue;
    if (u.x > b.x + m && u.x < b.x + b.w - m && u.y > b.y + m && u.y < b.y + b.h - m) return b;
  }
  return null;
}

/** A unit inside a field walks straight to the nearest free spot next to it (false: none). */
function walkOut(state: GameState, u: Unit, field: Rect): boolean {
  const out = approachPoint(state.grid, field, u);
  if (!out) return false;
  clearGoal(u);
  walkStraight(u, out);
  return true;
}

/**
 * Nearest source `u` can gather that yields `resource`, within the retarget radius of (x, y),
 * that has a free spot to stand on: a node, or an own gather building with a free slot (e.g. a
 * free farm). Skips `exclude`. Ties: the lower id.
 */
export function findSource(
  state: GameState,
  u: Unit,
  resource: ResourceType,
  x: number,
  y: number,
  exclude: number | null,
): GatherSource | null {
  const radius = DATA.game.gathering.retargetRadius;
  const candidates: Array<[number, GatherSource]> = [];
  const add = (src: GatherSource | null): void => {
    if (!src || src.id === exclude || src.resource !== resource) return;
    const d = Math.hypot(src.x + src.w / 2 - x, src.y + src.h / 2 - y);
    if (d <= radius) candidates.push([d, src]);
  };
  for (const n of state.nodes.values()) if (n.resource === resource) add(sourceFor(state, n.id, u));
  for (const b of state.buildings.values()) {
    if (b.owner !== u.owner || !DATA.buildings[b.type]?.gather) continue;
    const src = sourceFor(state, b.id, u);
    if (src?.building && hasFreeSlot(state, src.building, u)) add(src);
  }
  candidates.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
  for (const [, src] of candidates) if (approachPoint(state.grid, src, u)) return src;
  return null;
}

export function depleteNode(state: GameState, node: ResourceNode): void {
  state.nodes.delete(node.id);
  state.nodeViews.delete(node.id);
  state.grid.unblock(node.x, node.y, node.w, node.h);
  state.nodesVersion++;
  state.events.push({ type: 'resourceDepleted', node: node.id });
}

/** Text for the info panel. */
export function describeTask(u: Unit): string {
  const o = u.orders[0];
  if (!o) return 'Idle';
  if (o.kind === 'move') return 'Moving';
  if (o.kind === 'attackMove') return 'Attack-moving';
  if (o.kind === 'attack') return 'Attacking';
  const name = DATA.resources[o.resource]?.name.toLowerCase() ?? o.resource;
  return o.phase === 'harvest' ? `Gathering ${name}` : `Going to gather ${name}`;
}
