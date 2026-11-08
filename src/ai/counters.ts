/**
 * Counter pick (docs/ai-modes.md, docs/units.md): which unit type is the best answer to the enemy
 * army the machine sees. Everything comes from the game data, with the engine's damage formula:
 *   hit = max(minDamage, attack.damage + attack.bonus[target class] − target armor)
 *
 * For a candidate type u against the enemy soldiers E (each weighted by its cost):
 *   kill(u)   = Σ share_e · (hit(u→e) / cooldown_u) / hp_e · cost_e   enemy value u destroys per second
 *   hurt(u)   = Σ share_e · (hit(e→u) / cooldown_e) / cost_e          damage u takes per enemy resource
 *   score(u)  = kill(u) · hp_u / hurt(u) / cost_u²  × rangedEdge (ranged u vs melee e)
 * Dividing by cost² follows Lanchester's square law: for the same money, a cheaper unit fields
 * more bodies, and both its damage and its staying power grow with the count. A ranged unit
 * shooting at melee units gets free hits while they walk in, which `rangedEdge` stands for.
 */
import type { GameData, ObservedUnit, UnitTypeId } from '../shared';

export function unitValue(data: GameData, type: UnitTypeId): number {
  return Object.values(data.units[type]?.cost ?? {}).reduce((a, b) => a + (b ?? 0), 0);
}

/** Damage of one hit of `attacker` on `target` (the engine formula). */
export function hitDamage(data: GameData, attacker: UnitTypeId, target: UnitTypeId): number {
  const a = data.units[attacker]?.attack;
  const t = data.units[target];
  if (!a || !t) return 0;
  return Math.max(data.game.combat.minDamage, a.damage + (a.bonus[t.class] ?? 0) - t.armor);
}

/** How good `type` is against the enemy army (higher is better; 0 with no enemy or no attack). */
export function counterScore(
  data: GameData,
  type: UnitTypeId,
  enemy: readonly ObservedUnit[],
  rangedEdge: number,
): number {
  const me = data.units[type];
  if (!me?.attack || enemy.length === 0) return 0;
  const cost = Math.max(1, unitValue(data, type));
  let total = 0;
  const weight = new Map<UnitTypeId, number>();
  for (const e of enemy) {
    const v = unitValue(data, e.type);
    weight.set(e.type, (weight.get(e.type) ?? 0) + v);
    total += v;
  }
  if (total <= 0) return 0;
  let kill = 0;
  let hurt = 0;
  for (const [e, w] of weight) {
    const def = data.units[e];
    if (!def) continue;
    const share = w / total;
    const edge = me.attack.range > 0 && (def.attack?.range ?? 0) === 0 ? rangedEdge : 1;
    kill += share * edge * (hitDamage(data, type, e) / me.attack.cooldown / def.hp) * unitValue(data, e);
    if (def.attack)
      hurt += (share * (hitDamage(data, e, type) / def.attack.cooldown)) / Math.max(1, unitValue(data, e));
  }
  return (kill * me.hp) / Math.max(1e-6, hurt) / (cost * cost);
}

/** The best answer among `options` (ties: the first listed), or null when nothing scores. */
export function bestCounter(
  data: GameData,
  options: readonly UnitTypeId[],
  enemy: readonly ObservedUnit[],
  rangedEdge: number,
): UnitTypeId | null {
  let best: UnitTypeId | null = null;
  let bestScore = 0;
  for (const o of options) {
    const s = counterScore(data, o, enemy, rangedEdge);
    if (s > bestScore + 1e-9) {
      best = o;
      bestScore = s;
    }
  }
  return best;
}
