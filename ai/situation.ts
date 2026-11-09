/**
 * Situation analysis: turns one Observation into the facts every decision uses (own economy,
 * population, production, army strength, enemy strength, threats near the base, where home and the
 * enemy are). Pure function of the observation, the game data and the profile.
 */
import type {
  GameData,
  ObservedBuilding,
  ObservedUnit,
  Observation,
  PlayerId,
  ResourceType,
  StaticMapInfo,
  UnitTypeId,
} from '../src/shared';
import type { AIProfile } from './profile';

export interface Point {
  x: number;
  y: number;
}

export interface Situation {
  seconds: number;
  me: PlayerId;
  /** The building whose loss loses the game (game.json → victory), or null. */
  home: ObservedBuilding | null;
  homeCenter: Point;
  enemyHome: ObservedBuilding | null;
  enemyHomeCenter: Point;
  /** Unit vector from home toward the enemy home. */
  front: Point;
  staging: Point;

  workers: ObservedUnit[];
  idleWorkers: ObservedUnit[];
  gatherers: Record<ResourceType, number>;
  army: ObservedUnit[];
  armyPop: number;
  armyStrength: number;
  armyCenter: Point | null;

  enemyArmy: ObservedUnit[];
  enemyArmyStrength: number;
  /** Strength of enemy buildings that shoot, near the enemy home. */
  enemyDefence: number;
  threats: ObservedUnit[];
  threatStrength: number;
  threatCenter: Point | null;

  /** Own buildings (sites included) by type. */
  ownByType: Map<string, ObservedBuilding[]>;
  /** Own finished buildings that can train each unit type. */
  producers: Map<UnitTypeId, ObservedBuilding[]>;
  /** Population already paid for in production queues. */
  queuedPop: number;
  freePop: number;
}

export function isGatherer(data: GameData, type: UnitTypeId): boolean {
  return Object.keys(data.units[type]?.interactions.gather?.targets ?? {}).length > 0;
}

export function isMilitary(data: GameData, type: UnitTypeId): boolean {
  return !!data.units[type]?.attack && !isGatherer(data, type);
}

/** A siege unit (the Catapult): a soldier whose bonus against buildings is bigger than its base damage. */
export function isSiege(data: GameData, type: UnitTypeId): boolean {
  const a = data.units[type]?.attack;
  return isMilitary(data, type) && !!a && (a.bonus.building ?? 0) > a.damage;
}

/** Damage per second of an attack against an average target (bonus ignored). */
function dps(attack: { damage: number; cooldown: number } | undefined): number {
  return attack ? attack.damage / Math.max(0.1, attack.cooldown) : 0;
}

export function unitStrength(data: GameData, u: ObservedUnit): number {
  return u.hp * dps(data.units[u.type]?.attack);
}

export function center(rect: { x: number; y: number; w: number; h: number }): Point {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function centroid(units: readonly ObservedUnit[]): Point | null {
  if (units.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const u of units) {
    x += u.x;
    y += u.y;
  }
  return { x: x / units.length, y: y / units.length };
}

/** Distance from a point to a rectangle's edge (0 inside). */
export function distToRect(p: Point, r: { x: number; y: number; w: number; h: number }): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

export function analyze(obs: Observation, info: StaticMapInfo, profile: AIProfile): Situation {
  const { data } = info;
  const me = obs.player;
  const key = new Set(data.game.victory.defeatWhenLost);
  const own = obs.buildings.filter((b) => b.owner === me);
  const theirs = obs.buildings.filter((b) => b.owner !== me);
  const spawnOf = (p: PlayerId): Point => {
    const s = info.spawns.find((sp) => sp.player === p) ?? info.spawns[0];
    return s ? center(s) : { x: info.width / 2, y: info.height / 2 };
  };
  const pickHome = (list: ObservedBuilding[], fallback: Point): ObservedBuilding | null =>
    [...list]
      .filter((b) => key.has(b.type))
      .sort((a, b) => dist(center(a), fallback) - dist(center(b), fallback) || a.id - b.id)[0] ?? null;
  const enemyId = (info.spawns.find((s) => s.player !== me)?.player ?? (me === 0 ? 1 : 0)) as PlayerId;
  const home = pickHome(own, spawnOf(me));
  const homeCenter = home ? center(home) : spawnOf(me);
  const enemyHome = pickHome(theirs, spawnOf(enemyId));
  const enemyHomeCenter = enemyHome ? center(enemyHome) : spawnOf(enemyId);
  const d = dist(homeCenter, enemyHomeCenter) || 1;
  const front = { x: (enemyHomeCenter.x - homeCenter.x) / d, y: (enemyHomeCenter.y - homeCenter.y) / d };
  // Staging: in front of the base toward the enemy, on open ground just outside the reach of our
  // own shooting buildings (the army meets the enemy in the field, not under its towers).
  const shooters = own.filter((b) => b.constructed && data.buildings[b.type]?.attack);
  let staging = {
    x: homeCenter.x + front.x * profile.army.stagingDistance,
    y: homeCenter.y + front.y * profile.army.stagingDistance,
  };
  for (let k = profile.army.stagingDistance; k <= profile.army.stagingDistance + 14; k += 0.5) {
    const p = { x: homeCenter.x + front.x * k, y: homeCenter.y + front.y * k };
    const tx = Math.floor(p.x);
    const ty = Math.floor(p.y);
    if (tx < 0 || ty < 0 || tx >= info.width || ty >= info.height) break;
    const open = info.passable[ty * info.width + tx] === 1;
    const covered = shooters.some(
      (b) => distToRect(p, b) <= (data.buildings[b.type]?.attack?.range ?? 0) + 2,
    );
    if (open && !covered) {
      staging = p;
      break;
    }
  }

  const mine = obs.units.filter((u) => u.owner === me);
  const workers = mine.filter((u) => isGatherer(data, u.type));
  const gatherers: Record<ResourceType, number> = { food: 0, wood: 0, gold: 0 };
  for (const w of workers) if (w.order.kind === 'gather') gatherers[w.order.resource]++;
  const army = mine.filter((u) => isMilitary(data, u.type));
  const enemyUnits = obs.units.filter((u) => u.owner !== me);
  const enemyArmy = enemyUnits.filter((u) => isMilitary(data, u.type));

  let enemyDefence = 0;
  for (const b of theirs) {
    const atk = b.constructed ? data.buildings[b.type]?.attack : undefined;
    if (atk && dist(center(b), enemyHomeCenter) < 14) enemyDefence += profile.army.defenceHp * dps(atk);
  }

  const threats = enemyUnits.filter(
    (u) => isMilitary(data, u.type) && own.some((b) => distToRect(u, b) <= profile.defence.threatRadius),
  );

  const ownByType = new Map<string, ObservedBuilding[]>();
  const producers = new Map<UnitTypeId, ObservedBuilding[]>();
  let queuedPop = 0;
  for (const b of own) {
    ownByType.set(b.type, [...(ownByType.get(b.type) ?? []), b]);
    for (const q of b.queue) queuedPop += data.units[q]?.pop ?? 0;
    if (!b.constructed) continue;
    for (const a of data.buildings[b.type]?.actions ?? [])
      if (a.type === 'train') producers.set(a.unit, [...(producers.get(a.unit) ?? []), b]);
  }

  const sum = (list: ObservedUnit[]): number => list.reduce((n, u) => n + unitStrength(data, u), 0);
  return {
    seconds: obs.tick / info.tickRate,
    me,
    home,
    homeCenter,
    enemyHome,
    enemyHomeCenter,
    front,
    staging,
    workers,
    idleWorkers: workers.filter((w) => w.order.kind === 'idle'),
    gatherers,
    army,
    armyPop: army.reduce((n, u) => n + (data.units[u.type]?.pop ?? 1), 0),
    armyStrength: sum(army),
    armyCenter: centroid(army),
    enemyArmy,
    enemyArmyStrength: sum(enemyArmy),
    enemyDefence,
    threats,
    threatStrength: sum(threats),
    threatCenter: centroid(threats),
    ownByType,
    producers,
    queuedPop,
    freePop: obs.popCap - obs.pop - queuedPop,
  };
}
