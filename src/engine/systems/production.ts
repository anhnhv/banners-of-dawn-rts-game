/**
 * Production (PLAN §2.7, §5.3 step 2): buildings work through their training queue. What a building
 * may train comes from its `actions` in buildings.json; cost, time and pop from units.json.
 */
import { secondsToTicks, type PlayerId, type ResourceAmounts, type UnitTypeId } from '../../shared';
import { DATA } from '../data';
import type { Building } from '../entities/Building';
import { gatherRate, type Unit } from '../entities/Unit';
import type { GameState } from '../GameState';
import { approachPoint } from './reach';

export function populationOf(state: GameState, player: PlayerId): { pop: number; popCap: number } {
  let pop = 0;
  for (const u of state.units.values()) if (u.owner === player) pop += u.pop;
  let cap = 0;
  for (const b of state.buildings.values())
    if (b.owner === player && b.constructed) cap += DATA.buildings[b.type]?.popProvided ?? 0;
  return { pop, popCap: Math.min(DATA.game.popCap, cap) };
}

export function canTrain(b: Building, unit: UnitTypeId): boolean {
  return DATA.buildings[b.type]?.actions.some((a) => a.type === 'train' && a.unit === unit) ?? false;
}

/** The first resource the player is short of for this cost, or null if affordable. */
export function shortOf(have: ResourceAmounts, cost: Partial<ResourceAmounts>): keyof ResourceAmounts | null {
  for (const r of ['food', 'wood', 'gold'] as const) if ((cost[r] ?? 0) > have[r]) return r;
  return null;
}

export function trainTicks(unit: UnitTypeId): number {
  const def = DATA.units[unit];
  return Math.max(1, secondsToTicks((def?.trainTime ?? 1) / DATA.game.pace.trainSpeed));
}

export function productionSystem(
  state: GameState,
  spawn: (owner: PlayerId, type: UnitTypeId, x: number, y: number) => Unit,
): void {
  for (const b of state.buildings.values()) {
    if (!b.constructed) continue;
    const item = b.queue[0];
    if (!item) {
      b.popBlocked = false;
      continue;
    }
    if (item.progress < item.total) {
      item.progress++;
      if (item.progress < item.total) continue;
    }
    const def = DATA.units[item.unit];
    const { pop, popCap } = populationOf(state, b.owner);
    if (!def || pop + def.pop > popCap) {
      if (!b.popBlocked) state.events.push({ type: 'popCapped', player: b.owner, building: b.id });
      b.popBlocked = true;
      continue;
    }
    b.popBlocked = false;
    b.queue.shift();
    const target = b.rally ?? { x: b.x + b.w / 2, y: b.y + b.h + 1 };
    const at = approachPoint(state.grid, b, target) ?? { x: b.x + b.w / 2, y: b.y + b.h + 0.5 };
    const u = spawn(b.owner, item.unit, at.x, at.y);
    u.facing = Math.atan2(target.x - at.x, target.y - at.y);
    applyRally(state, b, u);
    state.events.push({ type: 'unitTrained', player: b.owner, unit: u.id, unitType: u.type });
  }
}

/** New units go to the rally point; workers rallied onto a resource start gathering it. */
function applyRally(state: GameState, b: Building, u: Unit): void {
  const r = b.rally;
  if (!r) return;
  const node = r.target !== undefined ? state.nodes.get(r.target) : undefined;
  if (node && gatherRate(u.type, node.kind) > 0) {
    u.orders = [
      {
        kind: 'gather',
        target: node.id,
        resource: node.resource,
        phase: 'toNode',
        lastX: node.x,
        lastY: node.y,
      },
    ];
    return;
  }
  u.orders = [{ kind: 'move', x: r.x, y: r.y }];
}
