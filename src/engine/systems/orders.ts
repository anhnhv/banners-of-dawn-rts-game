/**
 * Order system (PLAN §5.3 step 4, §5.4): runs each unit's current order as a small state machine
 * and sets the unit's movement goal. Gather rates come from units.json → interactions.gather.
 *
 *   move:     go there, then done
 *   gather:   toNode → harvest. Every whole unit harvested goes straight into the owner's stockpile
 *             (no carrying, no drop sites). When the node runs out, retarget the nearest node of
 *             the same resource within `retargetRadius`.
 *   attack:   chase → in range → strike whenever the cooldown allows → target dead: done.
 *             Auto-acquired attacks give up beyond `combat.leash` from where they started (and go
 *             back there, or resume the attack-move); hold-stance units never chase them.
 *   attackMove: walk there; the targeting system inserts attacks for enemies met on the way.
 */
import { TICK_RATE, type ResourceType } from '../../shared';
import { DATA } from '../data';
import type { ResourceNode } from '../entities/Building';
import { gatherRate, type Order, type Unit } from '../entities/Unit';
import type { GameState } from '../GameState';
import { attackOf, centerOf, combatant, gap, inAttackRange, isUnit, strike } from './combat';
import { clearGoal, setGoal } from './movement';
import { approachPoint, inReach } from './reach';

const REACH = DATA.game.gathering.reach;

export function orderSystem(state: GameState): void {
  for (const u of state.units.values()) {
    u.activity = 'idle';
    const order = u.orders[0];
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
    // chase; re-path only when the target has moved away from the current goal
    if (!u.goal || Math.hypot(u.goal.x - target.x, u.goal.y - target.y) > 0.75) setGoal(state, u, c);
  } else if (!u.goal) {
    const spot = approachPoint(state.grid, target, u);
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
  let node = state.nodes.get(o.target);
  if (!node) {
    node = findNode(state, u, o.resource, o.lastX, o.lastY, null) ?? undefined;
    if (!node) {
      finish(u);
      return;
    }
    o.target = node.id;
    o.phase = 'toNode';
  }

  if (o.phase === 'toNode') {
    if (inReach(u, node, REACH)) {
      o.phase = 'harvest';
      clearGoal(u);
    } else {
      const spot = approachPoint(state.grid, node, u);
      if (!spot || (u.arrived && u.blocked)) {
        // this node cannot be reached: try another one of the same resource
        const other = findNode(state, u, o.resource, node.x, node.y, node.id);
        if (other) o.target = other.id;
        else finish(u);
        return;
      }
      setGoal(state, u, spot);
      if (u.arrived && !inReach(u, node, REACH)) clearGoal(u); // try again from here next tick
      return;
    }
  }

  // harvest
  if (!inReach(u, node, REACH)) {
    o.phase = 'toNode'; // pushed away
    return;
  }
  u.activity = 'work';
  u.facing = Math.atan2(node.x + node.w / 2 - u.x, node.y + node.h / 2 - u.y);
  const player = state.players.get(u.owner);
  u.workProgress += (gatherRate(u.type, node.kind) * DATA.game.pace.gatherRate) / TICK_RATE;
  while (u.workProgress >= 1 && node.amount > 0) {
    u.workProgress -= 1;
    node.amount -= 1;
    if (player) player.resources[node.resource] += 1;
  }
  const view = state.nodeViews.get(node.id);
  if (view) view.amount = node.amount;
  o.lastX = node.x;
  o.lastY = node.y;
  if (node.amount <= 0) {
    depleteNode(state, node);
    o.phase = 'toNode';
  }
}

/**
 * Nearest node the unit can gather that yields `resource`, within the retarget radius of (x, y),
 * that has a free spot to stand on. Skips `exclude`.
 */
export function findNode(
  state: GameState,
  u: Unit,
  resource: ResourceType,
  x: number,
  y: number,
  exclude: number | null,
): ResourceNode | null {
  const radius = DATA.game.gathering.retargetRadius;
  const candidates: Array<[number, ResourceNode]> = [];
  for (const n of state.nodes.values()) {
    if (n.id === exclude || n.resource !== resource || gatherRate(u.type, n.kind) <= 0) continue;
    const d = Math.hypot(n.x + n.w / 2 - x, n.y + n.h / 2 - y);
    if (d <= radius) candidates.push([d, n]);
  }
  candidates.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
  for (const [, n] of candidates) if (approachPoint(state.grid, n, u)) return n;
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
