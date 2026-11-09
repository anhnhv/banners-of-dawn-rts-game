/**
 * Gather sources (PLAN §2.1): what a worker can harvest. Either a resource node (runs out), or an
 * own finished building whose buildings.json entry has `gather` (e.g. a Farm: never runs out, at
 * most `gather.slots` workers at a time).
 *
 * Slots are not stored: every tick, gatherSlotSystem() counts the workers whose CURRENT order is
 * gathering from each such building: first those already harvesting there, then the others, each
 * in unit order. The first `slots` of them hold the slots; any extra one looks for another source
 * (orders.ts). So a slot frees itself when its worker dies, gets another order or the building is
 * destroyed, a newcomer never takes a working farmer's slot, and it is deterministic.
 */
import type { EntityId, ResourceType } from '../../shared';
import { DATA } from '../data';
import type { Building, Rect } from '../entities/Building';
import { gatherRate, type Unit } from '../entities/Unit';
import type { GameState } from '../GameState';

export interface GatherSource extends Rect {
  id: EntityId;
  /** Node kind or building type: the key of units.json → interactions.gather.targets. */
  kind: string;
  resource: ResourceType;
  /** A building source never runs out. */
  building: Building | null;
}

/** The building, if `u` may gather from it: own, finished, has `gather`, and `u` has a rate for it. */
export function gatherBuilding(state: GameState, id: EntityId, u: Unit): Building | null {
  const b = state.buildings.get(id);
  if (!b || b.owner !== u.owner || !b.constructed || b.hp <= 0) return null;
  if (!DATA.buildings[b.type]?.gather || gatherRate(u.type, b.type) <= 0) return null;
  return b;
}

/** The source `id` as `u` sees it (a node it can gather, or a gather building it may use), or null. */
export function sourceFor(state: GameState, id: EntityId, u: Unit): GatherSource | null {
  const node = state.nodes.get(id);
  if (node) {
    if (gatherRate(u.type, node.kind) <= 0) return null;
    return {
      id,
      x: node.x,
      y: node.y,
      w: node.w,
      h: node.h,
      kind: node.kind,
      resource: node.resource,
      building: null,
    };
  }
  const b = gatherBuilding(state, id, u);
  const def = b ? DATA.buildings[b.type]?.gather : undefined;
  if (!b || !def) return null;
  return { id, x: b.x, y: b.y, w: b.w, h: b.h, kind: b.type, resource: def.resource, building: b };
}

export function slotsOf(b: Building): number {
  return DATA.buildings[b.type]?.gather?.slots ?? 0;
}

/** True if `b` has a slot for `u`: fewer than `slots` OTHER workers gather from it right now. */
export function hasFreeSlot(state: GameState, b: Building, u: Unit): boolean {
  let others = 0;
  for (const w of state.units.values()) {
    if (w.id === u.id || w.hp <= 0) continue;
    const o = w.orders[0];
    if (o?.kind === 'gather' && o.target === b.id) others++;
  }
  return others < slotsOf(b);
}

/**
 * True if `u` holds one of `b`'s slots (it is among the first `slots` workers on it, see top), or
 * just took a free one (a worker that switched to `b` during this tick's orders).
 */
export function claimSlot(b: Building, u: Unit): boolean {
  if (b.gatherers.includes(u.id)) return true;
  if (b.gatherers.length >= slotsOf(b)) return false;
  b.gatherers.push(u.id);
  return true;
}

/** Once per tick, before orders: who holds the slots of each gather building (Building.gatherers). */
export function gatherSlotSystem(state: GameState): void {
  for (const b of state.buildings.values()) if (b.gatherers.length > 0 || slotsOf(b) > 0) b.gatherers = [];
  for (const harvesting of [true, false]) {
    for (const u of state.units.values()) {
      const o = u.orders[0];
      if (u.hp <= 0 || o?.kind !== 'gather' || (o.phase === 'harvest') !== harvesting) continue;
      const b = gatherBuilding(state, o.target, u);
      if (b && b.gatherers.length < slotsOf(b)) b.gatherers.push(u.id);
    }
  }
}
