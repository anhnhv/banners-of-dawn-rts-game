/**
 * Order system (PLAN §5.3 step 4, §5.4): runs each unit's current order as a small state machine
 * and sets the unit's movement goal. Everything a unit may do comes from the game data:
 * gather rates and carry capacity from units.json, drop sites from buildings.json.
 *
 *   move:     go there, then done
 *   gather:   toNode → harvest → (full) toDrop → toNode … ; when the node runs out, retarget the
 *             nearest node of the same resource within `retargetRadius`
 *   deposit:  walk to a drop site, unload, done
 */
import { TICK_RATE, type ResourceType } from '../../shared';
import { DATA } from '../data';
import type { Building, ResourceNode } from '../entities/Building';
import { carryCapacity, gatherRate, type Order, type Unit } from '../entities/Unit';
import type { GameState } from '../GameState';
import { clearGoal, setGoal } from './movement';
import { approachPoint, distanceToRect, inReach } from './reach';

const REACH = DATA.game.gathering.reach;

export function orderSystem(state: GameState): void {
  for (const u of state.units.values()) {
    u.activity = 'idle';
    const order = u.orders[0];
    if (!order) {
      if (u.goal) clearGoal(u);
      continue;
    }
    switch (order.kind) {
      case 'move':
        setGoal(state, u, order);
        if (u.arrived) finish(u);
        break;
      case 'gather':
        gather(state, u, order);
        break;
      case 'deposit':
        deposit(state, u, order);
        break;
    }
  }
}

function finish(u: Unit): void {
  u.orders.shift();
  clearGoal(u);
}

// ---- gather -----------------------------------------------------------------------------------

function gather(state: GameState, u: Unit, o: Extract<Order, { kind: 'gather' }>): void {
  let node = state.nodes.get(o.target);
  if (!node && o.phase !== 'toDrop') {
    node = findNode(state, u, o.resource, o.lastX, o.lastY, null) ?? undefined;
    if (node) {
      o.target = node.id;
      o.phase = 'toNode';
    } else if (u.carry && u.carry.amount > 0) {
      o.phase = 'toDrop'; // nothing left nearby: bring home what we have, then stop
    } else {
      finish(u);
      return;
    }
  }

  if (o.phase === 'toNode' && node) {
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

  if (o.phase === 'harvest' && node) {
    if (!inReach(u, node, REACH)) {
      o.phase = 'toNode'; // pushed away
      return;
    }
    u.activity = 'work';
    u.facing = Math.atan2(node.x + node.w / 2 - u.x, node.y + node.h / 2 - u.y);
    if (!u.carry || u.carry.resource !== node.resource) u.carry = { resource: node.resource, amount: 0 };
    const capacity = carryCapacity(u.type);
    u.workProgress += (gatherRate(u.type, node.kind) * DATA.game.pace.gatherRate) / TICK_RATE;
    while (u.workProgress >= 1 && u.carry.amount < capacity && node.amount > 0) {
      u.workProgress -= 1;
      u.carry.amount += 1;
      node.amount -= 1;
    }
    const view = state.nodeViews.get(node.id);
    if (view) view.amount = node.amount;
    o.lastX = node.x;
    o.lastY = node.y;
    if (node.amount <= 0) depleteNode(state, node);
    if (u.carry.amount >= capacity || node.amount <= 0) {
      o.phase = u.carry.amount > 0 ? 'toDrop' : 'toNode';
      u.workProgress = 0;
    }
    return;
  }

  if (o.phase === 'toDrop') {
    if (!u.carry || u.carry.amount <= 0) {
      o.phase = 'toNode';
      return;
    }
    const drop = nearestDropSite(state, u, u.carry.resource);
    if (!drop) return; // nowhere to unload: wait
    if (inReach(u, drop, REACH)) {
      unload(state, u);
      clearGoal(u);
      o.phase = 'toNode';
      return;
    }
    const spot = approachPoint(state.grid, drop, u);
    if (spot) setGoal(state, u, spot);
    if (u.arrived && u.blocked) finish(u);
  }
}

function deposit(state: GameState, u: Unit, o: Extract<Order, { kind: 'deposit' }>): void {
  const b = state.buildings.get(o.target);
  if (!b || !u.carry || !acceptsDrop(b, u.carry.resource)) {
    finish(u);
    return;
  }
  if (inReach(u, b, REACH)) {
    unload(state, u);
    finish(u);
    return;
  }
  const spot = approachPoint(state.grid, b, u);
  if (!spot) {
    finish(u);
    return;
  }
  setGoal(state, u, spot);
  if (u.arrived && u.blocked) finish(u);
}

function unload(state: GameState, u: Unit): void {
  if (!u.carry) return;
  const player = state.players.get(u.owner);
  if (player) player.resources[u.carry.resource] += u.carry.amount;
  u.carry = null;
}

// ---- lookups ------------------------------------------------------------------------------------

export function acceptsDrop(b: Building, resource: ResourceType): boolean {
  return DATA.buildings[b.type]?.dropSite.includes(resource) ?? false;
}

function nearestDropSite(state: GameState, u: Unit, resource: ResourceType): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const b of state.buildings.values()) {
    if (b.owner !== u.owner || !acceptsDrop(b, resource)) continue;
    const d = distanceToRect(u.x, u.y, b);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
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
  if (o.kind === 'deposit') return 'Dropping off';
  const name = DATA.resources[o.resource]?.name.toLowerCase() ?? o.resource;
  if (o.phase === 'harvest') return `Gathering ${name}`;
  if (o.phase === 'toDrop') return `Carrying ${name}`;
  return `Going to gather ${name}`;
}
