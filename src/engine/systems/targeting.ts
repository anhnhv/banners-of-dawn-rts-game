/**
 * Targeting (PLAN §2.8, §5.3 step 9). Every `combat.acquireEveryTicks` (staggered by id):
 *  - idle units with `combat.autoAttack`: aggressive stance scans its sight, hold stance its reach;
 *    an idle unit that was just hit goes for the attacker even beyond its sight (aggressive only);
 *  - attack-moving units go for a recent attacker first (even beyond sight), otherwise scan their
 *    sight; either way they insert an auto attack in front of the attack-move.
 * Buildings with an attack pick through `bestTarget` too (see combatSystem).
 *
 * Choice: lowest priority first (the unit hitting me = combat.attackerPriority, otherwise the
 * unit's own units.json → combat.targetPriority[class], else game.json → combat.targetPriority),
 * then nearest, then lowest id — deterministic.
 */
import { TICK_RATE, type AttackDef } from '../../shared';
import { DATA } from '../data';
import type { Unit } from '../entities/Unit';
import type { GameState } from '../GameState';
import { canHit, classOf, combatant, gap, isUnit, reachOf, type Combatant } from './combat';

export function targetingSystem(state: GameState): void {
  const every = DATA.game.combat.acquireEveryTicks;
  for (const u of state.units.values()) {
    if (u.hp <= 0 || (state.tick + u.id) % every !== 0) continue;
    const def = DATA.units[u.type];
    const attack = def?.attack;
    if (!def || !attack) continue;
    const order = u.orders[0];
    const here = { kind: 'attack' as const, auto: true, homeX: u.x, homeY: u.y };

    if (!order) {
      if (!def.combat.autoAttack) continue;
      const hold = u.stance === 'hold';
      const attacker = recentAttacker(state, u);
      if (attacker && !hold && canHit(u.owner, attack, attacker)) {
        u.orders = [{ ...here, target: attacker.id }];
        continue;
      }
      const t = bestTarget(state, u, attack, hold ? reachOf(attack) : Math.max(def.sight, reachOf(attack)));
      if (t) u.orders = [{ ...here, target: t.id }];
    } else if (order.kind === 'attackMove') {
      // strike back at whoever just hit me, even from beyond my sight (an archer outranging me)
      const attacker = recentAttacker(state, u);
      const t =
        attacker && canHit(u.owner, attack, attacker)
          ? attacker
          : bestTarget(state, u, attack, Math.max(def.sight, reachOf(attack)));
      if (t) u.orders.unshift({ ...here, target: t.id });
    }
  }
}

function recentAttacker(state: GameState, u: Unit): Combatant | null {
  const window = DATA.game.combat.retaliateSeconds * TICK_RATE;
  if (u.lastHitBy === null || state.tick - u.lastHitTick > window) return null;
  return combatant(state, u.lastHitBy);
}

/** Best enemy for `self`'s attack within `radius` (edge to edge), or null. */
export function bestTarget(
  state: GameState,
  self: Combatant,
  attack: AttackDef,
  radius: number,
): Combatant | null {
  const { attackerPriority, defaultPriority } = DATA.game.combat;
  const own = isUnit(self) ? DATA.units[self.type]?.combat.targetPriority : undefined;
  const targetPriority = own ?? DATA.game.combat.targetPriority;
  const lastHitBy = isUnit(self) ? self.lastHitBy : null;
  const minRange = attack.minRange ?? 0;
  let best: Combatant | null = null;
  let bestKey: [number, number, number] = [Infinity, Infinity, Infinity];
  const consider = (t: Combatant): void => {
    if (t.hp <= 0 || !canHit(self.owner, attack, t)) return;
    const d = gap(self, t);
    if (d > radius || d < minRange) return;
    const priority = t.id === lastHitBy ? attackerPriority : (targetPriority[classOf(t)] ?? defaultPriority);
    const key: [number, number, number] = [priority, d, t.id];
    if (
      key[0] < bestKey[0] ||
      (key[0] === bestKey[0] &&
        (key[1] < bestKey[1] - 1e-9 || (Math.abs(key[1] - bestKey[1]) <= 1e-9 && key[2] < bestKey[2])))
    ) {
      best = t;
      bestKey = key;
    }
  };
  if (attack.targets.includes('unit')) {
    const c = isUnit(self) ? { x: self.x, y: self.y } : { x: self.x + self.w / 2, y: self.y + self.h / 2 };
    const half = isUnit(self) ? 0 : Math.max(self.w, self.h) / 2;
    state.spatial.forEachNear(c.x, c.y, radius + half + 1, (t) => {
      if (state.units.has(t.id)) consider(t);
    });
  }
  if (attack.targets.includes('building')) for (const b of state.buildings.values()) consider(b);
  return best;
}
