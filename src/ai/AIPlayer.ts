/**
 * The machine player's brain. Every think it:
 *  1. analyzes the situation (situation.ts),
 *  2. decides what the army does (posture: build up → stage → attack / retreat, or defend),
 *  3. lists what it wants to buy (workers, houses, military buildings, a tower, soldiers) with
 *     priorities and lets the budget approve them,
 *  4. sends idle workers to the resource it needs most and rebalances gatherers.
 * It reacts to whatever the game looks like (a fresh start or a built-up base), not to a script.
 * Units, buildings, costs and what trains what all come from the game data (StaticMapInfo.data).
 */
import { Rng } from '../shared';
import type {
  AIProfile,
  BuildingTypeId,
  Command,
  EntityId,
  GameData,
  ObservedBuilding,
  ObservedNode,
  ObservedUnit,
  Observation,
  ResourceAmounts,
  ResourceType,
  StaticMapInfo,
  UnitTypeId,
} from '../shared';
import { allocate, type Cost, type Request } from './Budget';
import { DEFAULT_AI_MODE, PROFILES, type AIMode } from './profiles';
import {
  analyze,
  center,
  centroid,
  dist,
  distToRect,
  isGatherer,
  isMilitary,
  unitStrength,
  type Point,
  type Situation,
} from './situation';
import { TileMap, type Side } from './TileMap';

export type Posture = 'build' | 'stage' | 'attack' | 'retreat' | 'defend';

interface PendingBuild {
  kind: 'build';
  type: BuildingTypeId;
  rect: { x: number; y: number; w: number; h: number };
  cost: Cost;
  until: number;
}
interface PendingTrain {
  kind: 'train';
  building: EntityId;
  unit: UnitTypeId;
  cost: Cost;
  until: number;
}
type Pending = PendingBuild | PendingTrain;

const RESOURCES: ResourceType[] = ['food', 'wood', 'gold'];

export class MachinePlayer {
  profile: AIProfile = PROFILES[DEFAULT_AI_MODE];
  private rng = new Rng(1);
  private info!: StaticMapInfo;
  private data!: GameData;
  private map!: TileMap;
  private pending: Pending[] = [];
  /** Units given an order recently (it is not applied yet because of the reaction delay). */
  private readonly busyUntil = new Map<EntityId, number>();
  private readonly badSpots = new Set<string>();
  private lastBuildSpots: string[] = [];
  private posture: Posture = 'build';
  private postureSince = 0;
  private waveSize = 0;
  /** Whether the current attack on our base was noticed (defence.defendChance, rolled per attack). */
  private noticed: boolean | null = null;
  private nextAttackTick = 0;
  private lastArmyOrderTick = -Infinity;
  private lastRebalanceTick = 0;
  /** Last tick the army grew; a wave goes anyway when the army cannot grow any more. */
  private lastGrowthTick = 0;
  private lastArmyPop = 0;
  private lastSoldierTick = -Infinity;
  private debug = 'thinking…';

  get thinkTicks(): number {
    return Math.max(1, Math.round(this.profile.tempo.thinkSeconds * this.info.tickRate));
  }

  get delayTicks(): number {
    return Math.max(1, Math.round(this.profile.tempo.reactionSeconds * this.info.tickRate));
  }

  init(info: StaticMapInfo, mode: AIMode = DEFAULT_AI_MODE, seed = 1): void {
    this.profile = PROFILES[mode] ?? PROFILES[DEFAULT_AI_MODE];
    this.rng = new Rng(seed);
    this.waveSize = this.profile.attack.minWavePop;
    this.info = info;
    this.data = info.data;
    this.map = new TileMap(info);
  }

  debugText(): string {
    return this.debug;
  }

  think(obs: Observation): Command[] {
    if (obs.over) return [];
    this.readEvents(obs);
    this.pending = this.pending.filter((p) => p.until >= obs.tick);
    for (const [id, until] of this.busyUntil) if (until < obs.tick) this.busyUntil.delete(id);

    // not paying attention this time (tempo.daydreamChance)
    if (this.profile.tempo.daydreamChance > 0 && this.rng.next() < this.profile.tempo.daydreamChance) {
      this.debug = `${this.profile.name} AI · ${this.posture} · daydreaming…`;
      return [];
    }

    const sit = analyze(obs, this.info, this.profile);
    if (!sit.home) {
      this.debug = 'no home building';
      return [];
    }
    this.map.update(
      obs,
      this.pending.filter((p): p is PendingBuild => p.kind === 'build').map((p) => p.rect),
    );

    const army = this.military(obs, sit);
    const requests = [
      ...this.economyRequests(obs, sit),
      ...this.buildingRequests(obs, sit),
      ...this.armyRequests(obs, sit),
    ];
    this.lastBuildSpots = [];
    const budget = allocate(this.available(obs.resources), requests);
    const rally = this.rallies(sit);
    const room = Math.max(
      0,
      this.profile.tempo.maxCommandsPerThink - army.length - budget.commands.length - rally.length,
    );
    const workers = this.workerCommands(obs, sit, requests).slice(0, room);

    this.debug =
      `${this.profile.name} AI · ${this.posture} · army ${sit.armyPop} ` +
      `(${Math.round(sit.armyStrength)} vs ${Math.round(sit.enemyArmyStrength + sit.enemyDefence)}) · ` +
      `workers ${sit.workers.length}/${this.profile.economy.workerTarget} · ` +
      `next wave ${this.waveSize}${budget.saving ? ` · saving for ${budget.saving}` : ''}`;
    return [...army, ...budget.commands, ...rally, ...workers];
  }

  // ---- bookkeeping -----------------------------------------------------------------------------

  private readEvents(obs: Observation): void {
    for (const e of obs.events) {
      if (e.type === 'commandRejected' && e.player === obs.player && e.reason === 'BAD_PLACEMENT')
        for (const s of this.lastBuildSpots) this.badSpots.add(s);
    }
  }

  /** Resources minus what pending (sent but not yet applied) commands will spend. */
  private available(have: ResourceAmounts): ResourceAmounts {
    const left = { ...have };
    for (const p of this.pending) for (const r of RESOURCES) left[r] -= p.cost[r] ?? 0;
    for (const r of RESOURCES) left[r] = Math.max(0, left[r]);
    return left;
  }

  private appliedTick(obs: Observation): number {
    return obs.tick + this.delayTicks + 1;
  }

  private markBusy(obs: Observation, ids: EntityId[]): void {
    const until = this.appliedTick(obs) + this.info.tickRate;
    for (const id of ids) this.busyUntil.set(id, until);
  }

  private pendingTrains(building: EntityId): number {
    return this.pending.filter((p) => p.kind === 'train' && p.building === building).length;
  }

  private pendingBuilds(type: BuildingTypeId): number {
    return this.pending.filter((p) => p.kind === 'build' && p.type === type).length;
  }

  // ---- economy -------------------------------------------------------------------------------

  /** The gatherer unit type and the buildings that train it. */
  private workerType(): UnitTypeId | null {
    for (const b of Object.values(this.data.buildings))
      for (const a of b.actions) if (a.type === 'train' && isGatherer(this.data, a.unit)) return a.unit;
    return null;
  }

  private economyRequests(obs: Observation, sit: Situation): Request[] {
    const type = this.workerType();
    if (!type) return [];
    const def = this.data.units[type];
    if (!def) return [];
    const queued = (sit.producers.get(type) ?? []).reduce(
      (n, b) => n + b.queue.filter((q) => q === type).length + this.pendingTrains(b.id),
      0,
    );
    let missing = this.profile.economy.workerTarget - sit.workers.length - queued;
    // Resources are finite (berries run out): keep enough of what a worker costs for the army.
    if (sit.workers.length + queued >= this.profile.economy.minWorkers) {
      const short = RESOURCES.some((r) => {
        const c = (def.cost[r] ?? 0) * (queued + 1);
        return (
          c > 0 && obs.resources[r] + this.safeAmount(obs, sit, r) - c < this.profile.economy.armyReserve
        );
      });
      if (short) missing = 0;
    }
    const out: Request[] = [];
    for (const b of sit.producers.get(type) ?? []) {
      let slots = this.profile.economy.workerQueue - b.queue.length - this.pendingTrains(b.id);
      while (slots-- > 0 && missing-- > 0)
        out.push(this.trainRequest(obs, b, type, this.profile.priorities.worker));
    }
    return out;
  }

  private trainRequest(obs: Observation, b: ObservedBuilding, unit: UnitTypeId, priority: number): Request {
    const cost = this.data.units[unit]?.cost ?? {};
    return {
      priority,
      cost,
      label: `train ${unit}`,
      commit: () => {
        this.pending.push({ kind: 'train', building: b.id, unit, cost, until: this.appliedTick(obs) });
        return [{ type: 'train', building: b.id, unit }];
      },
    };
  }

  /** Share of workers each resource should get: what the current wish list costs, roughly. */
  private desiredShares(obs: Observation, sit: Situation, requests: Request[]): Record<ResourceType, number> {
    const want: Record<ResourceType, number> = { food: 0, wood: 0, gold: 0 };
    const add = (c: Cost, k = 1): void => {
      for (const r of RESOURCES) want[r] += (c[r] ?? 0) * k;
    };
    for (const r of requests) add(r.cost);
    // steady demand: a few soldiers of what we can train, and workers while below target
    for (const [unit] of sit.producers) {
      if (isMilitary(this.data, unit)) add(this.data.units[unit]?.cost ?? {}, 3);
      else if (sit.workers.length < this.profile.economy.workerTarget)
        add(this.data.units[unit]?.cost ?? {}, 2);
    }
    if (sit.producers.size === 0 || [...sit.producers.keys()].every((u) => !isMilitary(this.data, u)))
      add(this.cheapestBuilding((b) => this.trainsMilitary(b))?.cost ?? {}, 1);
    for (const r of RESOURCES) if (obs.resources[r] > this.profile.economy.plentyStock) want[r] *= 0.3;
    const total = RESOURCES.reduce((n, r) => n + want[r], 0);
    if (total <= 0) return { food: 0.5, wood: 0.5, gold: 0 };
    return { food: want.food / total, wood: want.wood / total, gold: want.gold / total };
  }

  private workerCommands(obs: Observation, sit: Situation, requests: Request[]): Command[] {
    const shares = this.desiredShares(obs, sit, requests);
    const counts = { ...sit.gatherers };
    const total = sit.workers.length;
    const deficit = (r: ResourceType): number => shares[r] * total - counts[r];
    const assigned = new Map<EntityId, number>();
    for (const w of sit.workers)
      if (w.order.kind === 'gather') assigned.set(w.order.node, (assigned.get(w.order.node) ?? 0) + 1);
    const out: Command[] = [];
    const send = (w: ObservedUnit, r: ResourceType): boolean => {
      const node = this.nodeFor(obs, sit, w, r, assigned);
      if (!node) return false;
      assigned.set(node.id, (assigned.get(node.id) ?? 0) + 1);
      out.push({ type: 'interact', units: [w.id], target: node.id });
      this.markBusy(obs, [w.id]);
      return true;
    };
    const byNeed = (): ResourceType[] => [...RESOURCES].sort((a, b) => deficit(b) - deficit(a));

    let budget = this.profile.economy.idleWorkersPerThink;
    for (const w of sit.idleWorkers) {
      if (this.busyUntil.has(w.id)) continue;
      if (budget-- <= 0) break;
      for (const r of byNeed()) {
        if (shares[r] <= 0 && r !== byNeed()[0]) continue;
        if (send(w, r)) {
          counts[r]++;
          break;
        }
      }
    }

    // rebalance: one worker from the most over-staffed to the most under-staffed resource
    const every = this.profile.economy.rebalanceSeconds * this.info.tickRate;
    if (every > 0 && obs.tick - this.lastRebalanceTick >= every) {
      this.lastRebalanceTick = obs.tick;
      const need = byNeed()[0] as ResourceType;
      const surplus = byNeed()[RESOURCES.length - 1] as ResourceType;
      if (need !== surplus && deficit(need) >= 1.5 && deficit(surplus) <= -1.5) {
        const w = sit.workers
          .filter(
            (u) => u.order.kind === 'gather' && u.order.resource === surplus && !this.busyUntil.has(u.id),
          )
          .sort((a, b) => dist(b, sit.homeCenter) - dist(a, sit.homeCenter) || a.id - b.id)[0];
        if (w && send(w, need)) {
          counts[need]++;
          counts[surplus]--;
        }
      }
    }
    return out;
  }

  /**
   * A node is safe to send workers to when it is on our half of the map (nearer our home than
   * theirs) and outside the reach of enemy buildings that shoot.
   */
  private isSafe(obs: Observation, sit: Situation, n: ObservedNode): boolean {
    const c = center(n);
    if (dist(c, sit.homeCenter) > dist(c, sit.enemyHomeCenter)) return false;
    for (const b of obs.buildings) {
      if (b.owner === obs.player) continue;
      const atk = this.data.buildings[b.type]?.attack;
      if (atk && distToRect(c, b) <= atk.range + 3) return false;
    }
    return true;
  }

  /** What is left of resource `r` in safe nodes. */
  private safeAmount(obs: Observation, sit: Situation, r: ResourceType): number {
    let n = 0;
    for (const node of obs.nodes) if (node.resource === r && this.isSafe(obs, sit, node)) n += node.amount;
    return n;
  }

  /** A node of resource `r` near home: close to home first, then to the worker, spreading workers out. */
  private nodeFor(
    obs: Observation,
    sit: Situation,
    w: ObservedUnit,
    r: ResourceType,
    assigned: Map<EntityId, number>,
  ): ObservedNode | null {
    const candidates = obs.nodes
      .filter(
        (n) =>
          n.resource === r &&
          n.amount > 0 &&
          (this.data.units[w.type]?.interactions.gather?.targets[n.kind] ?? 0) > 0,
      )
      .filter((n) => this.isSafe(obs, sit, n));
    const near = candidates.filter((n) => distToRect(sit.homeCenter, n) <= this.profile.economy.gatherRadius);
    const pool = near.length > 0 ? near : candidates;
    let best: ObservedNode | null = null;
    let bestScore = Infinity;
    for (const n of pool) {
      const c = center(n);
      const score = dist(c, sit.homeCenter) + 0.5 * dist(c, w) + 3 * (assigned.get(n.id) ?? 0);
      if (score < bestScore - 1e-9) {
        best = n;
        bestScore = score;
      }
    }
    return best;
  }

  // ---- buildings ------------------------------------------------------------------------------

  private trainsMilitary(type: BuildingTypeId): boolean {
    return (this.data.buildings[type]?.actions ?? []).some(
      (a) => a.type === 'train' && isMilitary(this.data, a.unit),
    );
  }

  private totalCost(c: Cost): number {
    return RESOURCES.reduce((n, r) => n + (c[r] ?? 0), 0);
  }

  /** The cheapest building of the build menu that passes `test`. */
  private cheapestBuilding(
    test: (type: BuildingTypeId) => boolean,
  ): { type: BuildingTypeId; cost: Cost } | null {
    let best: { type: BuildingTypeId; cost: Cost } | null = null;
    for (const { building } of this.data.game.buildMenu) {
      const def = this.data.buildings[building];
      if (!def || !test(building)) continue;
      if (!best || this.totalCost(def.cost) < this.totalCost(best.cost))
        best = { type: building, cost: def.cost };
    }
    return best;
  }

  private count(sit: Situation, type: BuildingTypeId): number {
    return (sit.ownByType.get(type)?.length ?? 0) + this.pendingBuilds(type);
  }

  private sitesOf(sit: Situation, type: BuildingTypeId): number {
    return (sit.ownByType.get(type) ?? []).filter((b) => !b.constructed).length + this.pendingBuilds(type);
  }

  private buildingRequests(obs: Observation, sit: Situation): Request[] {
    const p = this.profile.buildings;
    const prio = this.profile.priorities;
    const militaryQueue = this.profile.army.militaryQueue;
    const out: Request[] = [];
    const militaryProducers = [...sit.ownByType.entries()]
      .filter(([t]) => this.trainsMilitary(t))
      .reduce((n, [, list]) => n + list.length, 0);
    const workerProducers = sit.producers.get(this.workerType() ?? '')?.length ?? 0;

    // houses: before production stalls on population
    const house = this.cheapestBuilding(
      (t) => (this.data.buildings[t]?.popProvided ?? 0) > 0 && !this.trainsAnything(t),
    );
    if (house && obs.popCap < this.data.game.popCap) {
      const buffer = p.houseBuffer + p.houseBufferPerProducer * (militaryProducers + workerProducers);
      const inProgress = this.sitesOf(sit, house.type);
      if ((sit.freePop <= buffer && inProgress === 0) || (sit.freePop <= 0 && inProgress < 2))
        this.pushBuild(out, obs, sit, house.type, prio.house, 'back', p.houseDistance);
    }

    // military production: the first one early, more when money piles up and all are busy
    for (const { building: type } of this.data.game.buildMenu) {
      if (!this.trainsMilitary(type)) continue;
      const def = this.data.buildings[type];
      if (!def) continue;
      const have = this.count(sit, type);
      const built = (sit.ownByType.get(type) ?? []).filter((b) => b.constructed);
      const allBusy = built.every((b) => b.queue.length >= militaryQueue);
      const rich = RESOURCES.every((r) => (def.cost[r] ?? 0) === 0 || obs.resources[r] > p.extraProducerBank);
      if (have === 0 && sit.workers.length >= p.firstProducerAtWorkers)
        this.pushBuild(out, obs, sit, type, prio.firstProducer, 'front', p.militaryDistance);
      else if (have > 0 && have < p.maxProducersPerType && this.sitesOf(sit, type) === 0 && allBusy && rich)
        this.pushBuild(out, obs, sit, type, prio.extraProducer, 'front', p.militaryDistance);
    }

    // a defensive tower once the base is going
    const tower = this.cheapestBuilding((t) => !!this.data.buildings[t]?.attack && !this.trainsAnything(t));
    if (tower && sit.seconds >= p.towerAfterSeconds && this.count(sit, tower.type) < p.towers)
      this.pushBuild(out, obs, sit, tower.type, prio.tower, 'front', p.towerDistance);
    return out;
  }

  private trainsAnything(type: BuildingTypeId): boolean {
    return (this.data.buildings[type]?.actions ?? []).some((a) => a.type === 'train');
  }

  private pushBuild(
    out: Request[],
    obs: Observation,
    sit: Situation,
    type: BuildingTypeId,
    priority: number,
    side: Side,
    [near, far]: readonly [number, number],
  ): void {
    const def = this.data.buildings[type];
    if (!def) return;
    const [w, h] = def.footprint;
    const spot = this.map.findSpot(
      { w, h, around: sit.homeCenter, front: sit.front, side, near, far: far + 6 },
      this.badSpots,
    );
    if (!spot) return;
    const cost = def.cost;
    out.push({
      priority,
      cost,
      label: type,
      commit: () => {
        const rect = { x: spot.x, y: spot.y, w, h };
        this.pending.push({ kind: 'build', type, rect, cost, until: this.appliedTick(obs) });
        this.lastBuildSpots.push(`${spot.x},${spot.y}`);
        return [{ type: 'build', building: type, at: { x: spot.x, y: spot.y } }];
      },
    });
  }

  // ---- army production --------------------------------------------------------------------------

  private armyRequests(obs: Observation, sit: Situation): Request[] {
    const out: Request[] = [];
    const urgent = sit.threats.length > 0;
    // a slow player trains one soldier at a time, with a pause between (army.trainEverySeconds)
    const every = this.profile.army.trainEverySeconds * this.info.tickRate;
    if (every > 0 && obs.tick - this.lastSoldierTick < every) return out;
    const inArmy = new Map<UnitTypeId, number>();
    for (const u of sit.army) inArmy.set(u.type, (inArmy.get(u.type) ?? 0) + 1);
    let room = sit.freePop;
    for (const list of sit.ownByType.values()) {
      for (const b of list) {
        if (!b.constructed) continue;
        const options = (this.data.buildings[b.type]?.actions ?? [])
          .filter((a) => a.type === 'train' && isMilitary(this.data, a.unit))
          .map((a) => (a.type === 'train' ? a.unit : ''));
        if (options.length === 0) continue;
        let slots = this.profile.army.militaryQueue - b.queue.length - this.pendingTrains(b.id);
        while (slots-- > 0) {
          // the type we have fewest of, for a mixed army
          const unit = [...options].sort(
            (a, c) => (inArmy.get(a) ?? 0) - (inArmy.get(c) ?? 0) || a.localeCompare(c),
          )[0];
          const pop = unit ? (this.data.units[unit]?.pop ?? 1) : 1;
          if (!unit || room < pop) break;
          room -= pop;
          inArmy.set(unit, (inArmy.get(unit) ?? 0) + 1);
          const req = this.trainRequest(
            obs,
            b,
            unit,
            urgent ? this.profile.priorities.defenceSoldier : this.profile.priorities.soldier,
          );
          const commit = req.commit;
          req.commit = () => {
            this.lastSoldierTick = obs.tick;
            return commit();
          };
          out.push(req);
          if (every > 0) return out;
        }
      }
    }
    return out;
  }

  /** Military buildings send new units to the staging point. */
  private rallies(sit: Situation): Command[] {
    const out: Command[] = [];
    for (const list of sit.ownByType.values()) {
      for (const b of list) {
        if (!b.constructed || !this.trainsMilitary(b.type)) continue;
        if (b.rally && dist(b.rally, sit.staging) < 3) continue;
        out.push({ type: 'setRally', building: b.id, to: { ...sit.staging } });
      }
    }
    return out;
  }

  // ---- army control ------------------------------------------------------------------------------

  private setPosture(p: Posture, tick: number): void {
    if (this.posture === p) return;
    this.posture = p;
    this.postureSince = tick;
    this.lastArmyOrderTick = -Infinity;
  }

  private canReissue(obs: Observation): boolean {
    return obs.tick - this.lastArmyOrderTick >= this.profile.army.reissueSeconds * this.info.tickRate;
  }

  /** Enemy strength (units and shooting buildings) within `radius` of a point. */
  private enemyStrengthNear(obs: Observation, at: Point, radius: number): number {
    let s = 0;
    for (const u of obs.units)
      if (u.owner !== obs.player && isMilitary(this.data, u.type) && dist(u, at) <= radius)
        s += unitStrength(this.data, u);
    for (const b of obs.buildings) {
      const atk = b.constructed && b.owner !== obs.player ? this.data.buildings[b.type]?.attack : undefined;
      if (atk && distToRect(at, b) <= radius)
        s += (this.profile.army.defenceHp * atk.damage) / Math.max(0.1, atk.cooldown);
    }
    return s;
  }

  private nearestEnemyBuilding(obs: Observation, at: Point): ObservedBuilding | null {
    let best: ObservedBuilding | null = null;
    let bestD = Infinity;
    for (const b of obs.buildings) {
      if (b.owner === obs.player) continue;
      const d = distToRect(at, b);
      if (d < bestD - 1e-9) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }

  private military(obs: Observation, sit: Situation): Command[] {
    const p = { ...this.profile.attack, ...this.profile.retreat, ...this.profile.defence };
    const tps = this.info.tickRate;
    const ids = (list: ObservedUnit[]): EntityId[] => list.map((u) => u.id);
    const out: Command[] = [];
    if (sit.army.length === 0) {
      if (this.posture === 'attack' || this.posture === 'stage') {
        this.waveSize += p.waveGrowth;
        this.nextAttackTick = obs.tick + p.retreatCooldownSeconds * tps;
      }
      this.setPosture('build', obs.tick);
      return out;
    }

    // defend: enemies near our buildings come first (unless it is a small raid while we are away)
    // a new attack on the base is noticed only with defence.defendChance (rolled once per attack)
    if (!sit.threatCenter) this.noticed = null;
    else if (this.noticed === null) this.noticed = this.rng.next() < p.defendChance;
    const armyHome = sit.armyCenter ? dist(sit.armyCenter, sit.homeCenter) < p.homeRadius : true;
    if (
      sit.threatCenter &&
      this.noticed &&
      (armyHome || sit.threatStrength >= p.raidShare * sit.armyStrength)
    ) {
      this.setPosture('defend', obs.tick);
      if (this.canReissue(obs)) {
        const free = sit.army.filter((u) => u.order.kind !== 'attack');
        if (free.length > 0) {
          out.push({ type: 'attackMove', units: ids(free), to: { ...sit.threatCenter } });
          this.lastArmyOrderTick = obs.tick;
        }
      }
      return out;
    }
    if (this.posture === 'defend') this.setPosture('build', obs.tick);

    if (sit.armyPop > this.lastArmyPop) this.lastGrowthTick = obs.tick;
    this.lastArmyPop = sit.armyPop;
    const stalledFor = (obs.tick - this.lastGrowthTick) / tps;
    const stalled = stalledFor >= p.stalledSeconds && sit.armyPop >= p.minStalledWavePop;
    // the longer nothing changes, the more risk the AI accepts (breaks a standoff)
    const patience = Math.min(1, Math.max(0, (stalledFor - p.stalledSeconds) / p.desperationSeconds));
    const stalledRatio = p.stalledAttackRatio - (p.stalledAttackRatio - p.desperateRatio) * patience;
    const enemyTotal = sit.enemyArmyStrength + sit.enemyDefence;
    const canAttack =
      sit.seconds >= p.earliestAttackSeconds &&
      obs.tick >= this.nextAttackTick &&
      (sit.armyPop >= this.waveSize || stalled) &&
      sit.armyStrength >= (stalled ? stalledRatio : p.attackRatio) * enemyTotal &&
      sit.enemyHome !== null;

    switch (this.posture) {
      case 'build': {
        if (canAttack) {
          this.setPosture('stage', obs.tick);
          break;
        }
        const stray = sit.army.filter((u) => u.order.kind === 'idle' && dist(u, sit.staging) > 5);
        if (stray.length > 0 && this.canReissue(obs)) {
          out.push({ type: 'move', units: ids(stray), to: { ...sit.staging } });
          this.lastArmyOrderTick = obs.tick;
        }
        break;
      }
      case 'stage': {
        const arrived = sit.army.filter((u) => dist(u, sit.staging) <= 6).length / sit.army.length;
        if (arrived >= p.regroupArrivedShare || obs.tick - this.postureSince >= p.regroupSeconds * tps) {
          this.setPosture('attack', obs.tick);
          break;
        }
        const away = sit.army.filter((u) => dist(u, sit.staging) > 6 && u.order.kind !== 'move');
        if (away.length > 0 && this.canReissue(obs)) {
          out.push({ type: 'move', units: ids(away), to: { ...sit.staging } });
          this.lastArmyOrderTick = obs.tick;
        }
        break;
      }
      case 'attack': {
        // the attacking squad: the whole army, or (attack.groupSize) only a few at a time
        const busy = (u: ObservedUnit): boolean => u.order.kind === 'attack' || u.order.kind === 'attackMove';
        let squad = sit.army;
        if (p.groupSize > 0) {
          const fighting = sit.army.filter(busy);
          const rest = sit.army.filter((u) => !busy(u)).sort((a, b) => a.id - b.id);
          squad = [...fighting, ...rest.slice(0, Math.max(0, p.groupSize - fighting.length))];
        }
        const at = centroid(squad) ?? sit.homeCenter;
        const squadStrength = squad.reduce((n, u) => n + unitStrength(this.data, u), 0);
        const local = this.enemyStrengthNear(obs, at, 10);
        if (local > 0 && p.retreatRatio > 0 && squadStrength < p.retreatRatio * local) {
          this.setPosture('retreat', obs.tick);
          this.waveSize += p.waveGrowth;
          this.nextAttackTick = obs.tick + p.retreatCooldownSeconds * tps;
          out.push({ type: 'move', units: ids(sit.army), to: { ...sit.staging } });
          this.lastArmyOrderTick = obs.tick;
          break;
        }
        // the Town Hall wins the game; a distracted player goes for whatever is nearest
        const target = p.target === 'nearestBuilding' ? this.nearestEnemyBuilding(obs, at) : sit.enemyHome;
        if (!target || !this.canReissue(obs)) break;
        const enemiesClose = obs.units.some(
          (u) => u.owner !== obs.player && isMilitary(this.data, u.type) && dist(u, at) <= 8,
        );
        if (!enemiesClose && distToRect(at, target) <= 9) {
          const notOnIt = squad.filter((u) => !(u.order.kind === 'attack' && u.order.target === target.id));
          if (notOnIt.length > 0) out.push({ type: 'interact', units: ids(notOnIt), target: target.id });
        } else {
          const lazy = squad.filter((u) => u.order.kind === 'idle' || u.order.kind === 'move');
          if (lazy.length > 0) out.push({ type: 'attackMove', units: ids(lazy), to: center(target) });
        }
        this.lastArmyOrderTick = obs.tick;
        break;
      }
      case 'retreat': {
        const back = sit.armyCenter ? dist(sit.armyCenter, sit.staging) <= 6 : true;
        if (back || obs.tick - this.postureSince >= p.retreatGiveUpSeconds * tps)
          this.setPosture('build', obs.tick);
        break;
      }
      case 'defend':
        break;
    }
    return out;
  }
}
