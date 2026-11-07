/**
 * Combat (PLAN §2.4, §5.3 steps 10–12, §9.5). Everything comes from the game data:
 *   units.json / buildings.json → attack   damage, range, minRange, cooldown, bonus, projectile, splash
 *   projectiles.json                       speed, arc, homing, launch height
 *   game.json → combat                     min damage, melee reach, alert throttle
 *
 *   damage = max(minDamage, attack.damage + attack.bonus[target class] − target armor)
 *
 * Melee strikes land at once; ranged strikes spawn a projectile. Homing projectiles follow the
 * target and always hit; others land where the target was and may splash.
 */
import { secondsToTicks, TICK_RATE, type AttackDef, type EntityId, type PlayerId } from '../../shared';
import { DATA } from '../data';
import type { Building } from '../entities/Building';
import type { Projectile } from '../entities/Projectile';
import type { Unit } from '../entities/Unit';
import type { GameState } from '../GameState';
import { distanceToRect } from './reach';

/** Anything that can be attacked or attack. */
export type Combatant = Unit | Building;

export function isUnit(e: Combatant): e is Unit {
  return 'radius' in e;
}

/** Live unit or building by id (null when gone or at 0 HP). */
export function combatant(state: GameState, id: EntityId): Combatant | null {
  const e = state.units.get(id) ?? state.buildings.get(id) ?? null;
  return e && e.hp > 0 ? e : null;
}

export function classOf(e: Combatant): string {
  return isUnit(e) ? (DATA.units[e.type]?.class ?? '') : (DATA.buildings[e.type]?.class ?? 'building');
}

function armorOf(e: Combatant): number {
  return (isUnit(e) ? DATA.units[e.type]?.armor : DATA.buildings[e.type]?.armor) ?? 0;
}

/** The entity's attack, if it can attack now (construction sites cannot). */
export function attackOf(e: Combatant): AttackDef | undefined {
  if (isUnit(e)) return DATA.units[e.type]?.attack;
  return e.constructed ? DATA.buildings[e.type]?.attack : undefined;
}

export function centerOf(e: Combatant): { x: number; y: number } {
  return isUnit(e) ? { x: e.x, y: e.y } : { x: e.x + e.w / 2, y: e.y + e.h / 2 };
}

/** Edge-to-edge distance between two combatants. */
export function gap(a: Combatant, b: Combatant): number {
  if (isUnit(a) && isUnit(b)) return Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
  if (isUnit(a)) return distanceToRect(a.x, a.y, b as Building) - a.radius;
  if (isUnit(b)) return distanceToRect(b.x, b.y, a) - b.radius;
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.hypot(dx, dy);
}

/** How far an attack reaches (edge to edge): its range, or the melee reach for range 0. */
export function reachOf(attack: AttackDef): number {
  return attack.range > 0 ? attack.range : DATA.game.combat.meleeReach;
}

export function inAttackRange(a: Combatant, target: Combatant, attack: AttackDef): boolean {
  const g = gap(a, target);
  return g <= reachOf(attack) && g >= (attack.minRange ?? 0);
}

/** Whether `attack` may be used on `target` at all (enemy and an allowed kind). */
export function canHit(owner: PlayerId, attack: AttackDef, target: Combatant): boolean {
  if (target.owner === owner) return false;
  return attack.targets.includes(isUnit(target) ? 'unit' : 'building');
}

export function damageAgainst(attack: AttackDef, target: Combatant): number {
  const bonus = attack.bonus[classOf(target)] ?? 0;
  return Math.max(DATA.game.combat.minDamage, attack.damage + bonus - armorOf(target));
}

/** Strike now: melee damage lands at once, ranged attacks launch their projectile. */
export function strike(state: GameState, attacker: Combatant, target: Combatant, attack: AttackDef): void {
  attacker.cooldown = Math.max(1, secondsToTicks(attack.cooldown));
  attacker.strikeTick = state.tick;
  const from = centerOf(attacker);
  if (!attack.projectile) {
    applyDamage(state, attacker.id, from, target, damageAgainst(attack, target));
    return;
  }
  const def = DATA.projectiles[attack.projectile];
  if (!def) return;
  const to = centerOf(target);
  const z = attack.launchHeight ?? def.launchHeight;
  state.projectiles.set(state.nextId, {
    id: state.nextId++,
    kind: attack.projectile,
    owner: attacker.owner,
    source: attacker.id,
    attack,
    target: def.homing ? target.id : null,
    live: true,
    tx: to.x,
    ty: to.y,
    x: from.x,
    y: from.y,
    z,
    prevX: from.x,
    prevY: from.y,
    prevZ: z,
    startZ: z,
    endZ: isUnit(target) ? 0.3 : 0.6,
    flown: 0,
    speed: def.speed,
    arc: def.arc,
  });
}

/** Take HP off a target, remember the attacker, send the alert, make idle workers flee. */
export function applyDamage(
  state: GameState,
  source: EntityId,
  from: { x: number; y: number },
  target: Combatant,
  amount: number,
): void {
  if (target.hp <= 0) return;
  target.hp -= amount;
  const player = state.players.get(target.owner);
  const at = centerOf(target);
  if (player && state.tick - player.lastAlertTick >= DATA.game.combat.underAttackAlertSeconds * TICK_RATE) {
    player.lastAlertTick = state.tick;
    state.events.push({ type: 'underAttack', player: target.owner, x: at.x, y: at.y });
  }
  if (!isUnit(target)) return;
  target.lastHitBy = source;
  target.lastHitTick = state.tick;
  const flee = DATA.units[target.type]?.combat.fleeWhenHit ?? 0;
  if (flee > 0 && target.orders.length === 0 && target.hp > 0) {
    const dx = target.x - from.x;
    const dy = target.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const { width, height } = state.grid;
    target.orders = [
      {
        kind: 'move',
        x: Math.max(0.5, Math.min(width - 0.5, target.x + (dx / len) * flee)),
        y: Math.max(0.5, Math.min(height - 0.5, target.y + (dy / len) * flee)),
      },
    ];
  }
}

/** Count down cooldowns; finished buildings with an attack shoot the best target in range. */
export function combatSystem(
  state: GameState,
  pickTarget: (b: Building, attack: AttackDef) => Combatant | null,
): void {
  for (const u of state.units.values()) if (u.cooldown > 0) u.cooldown--;
  for (const b of state.buildings.values()) {
    if (b.cooldown > 0) b.cooldown--;
    const attack = attackOf(b);
    if (!attack) continue;
    let target = b.target !== null ? combatant(state, b.target) : null;
    if (target && !inAttackRange(b, target, attack)) target = null;
    if (!target && (state.tick + b.id) % DATA.game.combat.acquireEveryTicks === 0)
      target = pickTarget(b, attack);
    b.target = target?.id ?? null;
    if (target && b.cooldown <= 0) strike(state, b, target, attack);
  }
}

/** Fly projectiles; resolve hits on arrival. */
export function projectileSystem(state: GameState): void {
  for (const p of state.projectiles.values()) {
    p.prevX = p.x;
    p.prevY = p.y;
    p.prevZ = p.z;
    if (p.target !== null) {
      const t = combatant(state, p.target);
      if (t) {
        const c = centerOf(t);
        p.tx = c.x;
        p.ty = c.y;
      } else {
        p.target = null;
        p.live = false; // target gone: the arrow lands where it last was
      }
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const rest = Math.hypot(dx, dy);
    const step = p.speed / TICK_RATE;
    if (rest <= step) {
      impact(state, p);
      state.projectiles.delete(p.id);
      continue;
    }
    p.x += (dx / rest) * step;
    p.y += (dy / rest) * step;
    p.flown += step;
    const total = p.flown + rest - step;
    const t = total > 0 ? p.flown / total : 1;
    p.z = p.startZ + (p.endZ - p.startZ) * t + p.arc * total * 4 * t * (1 - t);
  }
}

function impact(state: GameState, p: Projectile): void {
  if (!p.live) return;
  const at = { x: p.tx, y: p.ty };
  if (p.target !== null) {
    const t = combatant(state, p.target);
    if (t) applyDamage(state, p.source, at, t, damageAgainst(p.attack, t));
    return;
  }
  const splash = p.attack.splash;
  const radius = splash?.radius ?? 0.35;
  const falloff = (d: number): number => (splash ? 1 - (1 - splash.edge) * Math.min(1, d / radius) : 1);
  const hits: Array<[Combatant, number]> = [];
  for (const u of state.units.values()) {
    if (u.hp <= 0 || !canHit(p.owner, p.attack, u)) continue;
    const d = Math.max(0, Math.hypot(u.x - at.x, u.y - at.y) - u.radius);
    if (d <= radius) hits.push([u, d]);
  }
  for (const b of state.buildings.values()) {
    if (b.hp <= 0 || !canHit(p.owner, p.attack, b)) continue;
    const d = distanceToRect(at.x, at.y, b);
    if (d <= radius) hits.push([b, d]);
  }
  if (!splash) hits.splice(1); // no splash: only the first thing at the point
  for (const [t, d] of hits) {
    const amount = Math.round(damageAgainst(p.attack, t) * falloff(d));
    applyDamage(state, p.source, at, t, Math.max(DATA.game.combat.minDamage, amount));
  }
}

/** Remove everything at 0 HP; free building tiles; emit events. */
export function deathSystem(state: GameState): void {
  for (const u of state.units.values()) {
    if (u.hp > 0) continue;
    state.units.delete(u.id);
    state.events.push({
      type: 'unitDied',
      unit: u.id,
      unitType: u.type,
      owner: u.owner,
      x: u.x,
      y: u.y,
      facing: u.facing,
    });
  }
  for (const b of state.buildings.values()) {
    if (b.hp > 0) continue;
    state.buildings.delete(b.id);
    state.grid.unblock(b.x, b.y, b.w, b.h);
    state.events.push({
      type: 'buildingDestroyed',
      building: b.id,
      buildingType: b.type,
      owner: b.owner,
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
    });
  }
}
