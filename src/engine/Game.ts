/**
 * The authoritative game (PLAN §5). Fixed 20 Hz ticks, deterministic for a given map, seed and
 * command log. The host feeds it commands and calls step(); the UI reads getView().
 *
 * Tick pipeline: commands → production → orders → pathfinding → movement → separation.
 */
import {
  Rng,
  type BuildingView,
  type Command,
  type CommandEnvelope,
  type DecodedMap,
  type EntityId,
  type GameEvent,
  type PlayerId,
  type PlayerView,
  type ResourceAmounts,
  type ResourceView,
  type UnitTypeId,
  type UnitView,
} from '../shared';
import { DATA } from './data';
import type { Building, ResourceNode } from './entities/Building';
import { createUnit, gatherRate, type Unit } from './entities/Unit';
import type { GameState, PlayerState } from './GameState';
import { loadMap, type LoadedMap, type SpawnPoint } from './map/loadMap';
import { PathFinder } from './path/astar';
import { assignSlots, formationSlots } from './path/groupMove';
import { SpatialHash } from './spatial/SpatialHash';
import { clearGoal, movementSystem, pathfindingSystem, separationSystem } from './systems/movement';
import {
  buildTicks,
  canPlace,
  clearFootprint,
  constructionSystem,
  inBuildMenu,
} from './systems/construction';
import { describeTask, orderSystem } from './systems/orders';
import { canTrain, populationOf, productionSystem, shortOf, trainTicks } from './systems/production';

export interface GameOptions {
  seed: number;
  /** Dev/testing: spawn this many extra units for the human player in front of their base. */
  testArmy?: number;
}

const TEST_ARMY_MIX: UnitTypeId[] = ['militia', 'militia', 'archer', 'knight', 'worker', 'scout_rider'];
/** Building type placed at each map spawn. */
const SPAWN_BUILDING = 'town_hall';

export class Game {
  private readonly state: GameState;
  private readonly loaded: LoadedMap;
  private readonly pending: CommandEnvelope[] = [];
  private readonly viewCache = new Map<PlayerId, PlayerView>();

  constructor(map: DecodedMap, options: GameOptions) {
    this.loaded = loadMap(map);
    const grid = this.loaded.grid;
    this.state = {
      tick: 0,
      grid,
      rng: new Rng(options.seed),
      players: new Map(),
      units: new Map(),
      buildings: new Map(),
      nodes: new Map(),
      nodeViews: new Map(),
      nodesVersion: 0,
      nextId: 1,
      pathFinder: new PathFinder(grid),
      pathQueue: [],
      spatial: new SpatialHash<Unit>(1),
      events: [],
    };
    for (const p of [0, 1] as const) {
      this.state.players.set(p, { id: p, resources: { ...DATA.game.startingResources } });
    }
    // Resource nodes (their tiles are already blocked by loadMap).
    for (const r of this.loaded.resources) {
      const node: ResourceNode = {
        id: this.state.nextId++,
        kind: r.kind,
        resource: r.resource,
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        amount: r.amount,
      };
      this.state.nodes.set(node.id, node);
      this.state.nodeViews.set(node.id, { ...node });
    }
    // Town Halls at the spawns (tiles already blocked by loadMap), then starting units.
    for (const spawn of this.loaded.spawns)
      this.addBuilding(spawn.player, SPAWN_BUILDING, spawn, false, true);
    for (const spawn of this.loaded.spawns) {
      for (const [type, count] of map.startUnits) if (DATA.units[type]) this.spawnAround(spawn, type, count);
    }
    const home = this.loaded.spawns.find((s) => s.player === 0);
    if (home && options.testArmy) this.spawnTestArmy(home, options.testArmy);
  }

  get tick(): number {
    return this.state.tick;
  }

  get width(): number {
    return this.state.grid.width;
  }

  get height(): number {
    return this.state.grid.height;
  }

  /** Read-only access for tests and tools. */
  get units(): ReadonlyMap<EntityId, Readonly<Unit>> {
    return this.state.units;
  }

  get buildings(): ReadonlyMap<EntityId, Readonly<Building>> {
    return this.state.buildings;
  }

  get nodes(): ReadonlyMap<EntityId, Readonly<ResourceNode>> {
    return this.state.nodes;
  }

  player(id: PlayerId): Readonly<PlayerState> {
    const p = this.state.players.get(id);
    if (!p) throw new Error(`No player ${id}`);
    return p;
  }

  /** Queue a command; it is applied at the start of the first step with tick ≥ env.tick. */
  enqueue(env: CommandEnvelope): void {
    this.pending.push(env);
  }

  /** Advance exactly one tick. Returns the events that happened during it. */
  step(): GameEvent[] {
    const s = this.state;
    s.events = [];
    for (const u of s.units.values()) {
      u.prevX = u.x;
      u.prevY = u.y;
    }
    const due = this.pending.filter((c) => c.tick <= s.tick);
    if (due.length > 0) {
      this.pending.splice(0, this.pending.length, ...this.pending.filter((c) => c.tick > s.tick));
      for (const env of due) this.apply(env);
    }
    constructionSystem(s);
    productionSystem(s, (owner, type, x, y) => this.addUnit(owner, type, x, y));
    orderSystem(s);
    pathfindingSystem(s);
    movementSystem(s);
    separationSystem(s);
    s.tick++;
    this.viewCache.clear();
    return s.events;
  }

  getView(player: PlayerId): PlayerView {
    const cached = this.viewCache.get(player);
    if (cached) return cached;
    const s = this.state;
    const units: UnitView[] = [];
    for (const u of s.units.values()) {
      units.push({
        id: u.id,
        owner: u.owner,
        type: u.type,
        x: u.x,
        y: u.y,
        prevX: u.prevX,
        prevY: u.prevY,
        facing: u.facing,
        moving: u.moving,
        activity: u.moving ? 'walk' : u.activity,
        task: describeTask(u),
        hasOrders: u.orders.length > 0,
        radius: u.radius,
        hp: u.hp,
        maxHp: u.maxHp,
      });
    }
    const buildings: BuildingView[] = [];
    for (const b of s.buildings.values()) {
      buildings.push({
        id: b.id,
        owner: b.owner,
        type: b.type,
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
        hp: b.hp,
        maxHp: b.maxHp,
        constructed: b.constructed,
        buildProgress: b.constructed ? 1 : b.buildProgress / b.buildTotal,
        queue: b.queue.map((q) => ({ unit: q.unit, progress: q.total > 0 ? q.progress / q.total : 1 })),
        popBlocked: b.popBlocked,
        rally: b.rally ? { ...b.rally } : null,
      });
    }
    const me = this.player(player);
    const resources: ResourceAmounts = {
      food: Math.floor(me.resources.food),
      wood: Math.floor(me.resources.wood),
      gold: Math.floor(me.resources.gold),
    };
    const view: PlayerView = {
      tick: s.tick,
      player,
      self: { resources, ...populationOf(s, player) },
      units,
      buildings,
      resources: s.nodeViews as ReadonlyMap<EntityId, ResourceView>,
      resourcesVersion: s.nodesVersion,
    };
    this.viewCache.set(player, view);
    return view;
  }

  /** Hash of the simulation state, for determinism tests. */
  stateHash(): string {
    let h = 2166136261;
    const mix = (v: number): void => {
      h = Math.imul(h ^ (Math.round(v * 1e4) | 0), 16777619);
    };
    for (const u of this.state.units.values()) {
      mix(u.id);
      mix(u.x);
      mix(u.y);
      mix(u.orders.length);
      mix(u.workProgress);
    }
    for (const p of this.state.players.values()) {
      mix(p.resources.food);
      mix(p.resources.wood);
      mix(p.resources.gold);
    }
    mix(this.state.nodes.size);
    return (h >>> 0).toString(16);
  }

  // ---- commands ----------------------------------------------------------------------------------

  private apply(env: CommandEnvelope): void {
    const s = this.state;
    const reject = (reason: string): void => {
      s.events.push({ type: 'commandRejected', player: env.player, reason });
    };
    const cmd: Command = env.cmd;
    const ownUnits = (ids: readonly EntityId[]): Unit[] =>
      ids.map((id) => s.units.get(id)).filter((u): u is Unit => !!u && u.owner === env.player);
    const ownBuilding = (id: EntityId): Building | null => {
      const b = s.buildings.get(id);
      return b && b.owner === env.player ? b : null;
    };

    switch (cmd.type) {
      case 'move': {
        const units = ownUnits(cmd.units);
        if (units.length === 0) return reject('NO_UNITS');
        if (!Number.isFinite(cmd.to.x) || !Number.isFinite(cmd.to.y)) return reject('BAD_TARGET');
        this.orderMove(units, cmd.to, cmd.queue ?? false);
        return;
      }
      case 'interact': {
        const units = ownUnits(cmd.units);
        if (units.length === 0) return reject('NO_UNITS');
        const node = s.nodes.get(cmd.target);
        const building = s.buildings.get(cmd.target);
        const movers: Unit[] = [];
        for (const u of units) {
          if (node && gatherRate(u.type, node.kind) > 0) {
            this.giveOrder(
              u,
              {
                kind: 'gather',
                target: node.id,
                resource: node.resource,
                phase: 'toNode',
                lastX: node.x,
                lastY: node.y,
              },
              cmd.queue ?? false,
            );
          } else {
            movers.push(u);
          }
        }
        // units that cannot do anything with the target just walk next to it
        const rect = node ?? building;
        if (movers.length > 0 && rect)
          this.orderMove(movers, { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, cmd.queue ?? false);
        if (!rect) return reject('BAD_TARGET');
        return;
      }
      case 'stop': {
        const units = ownUnits(cmd.units);
        if (units.length === 0) return reject('NO_UNITS');
        for (const u of units) {
          u.orders = [];
          clearGoal(u);
        }
        return;
      }
      case 'train': {
        const b = ownBuilding(cmd.building);
        if (!b) return reject('NOT_OWNER');
        if (!b.constructed || !canTrain(b, cmd.unit)) return reject('NOT_AVAILABLE');
        if (b.queue.length >= DATA.game.production.queueMax) return reject('QUEUE_FULL');
        const def = DATA.units[cmd.unit];
        const player = s.players.get(env.player);
        if (!def || !player) return reject('NOT_AVAILABLE');
        const short = shortOf(player.resources, def.cost);
        if (short) return reject(`NOT_ENOUGH_${short.toUpperCase()}`);
        for (const [r, v] of Object.entries(def.cost)) player.resources[r as keyof ResourceAmounts] -= v ?? 0;
        b.queue.push({ unit: cmd.unit, progress: 0, total: trainTicks(cmd.unit) });
        return;
      }
      case 'cancelTrain': {
        const b = ownBuilding(cmd.building);
        if (!b) return reject('NOT_OWNER');
        const item = b.queue[cmd.index];
        if (!item) return reject('BAD_TARGET');
        b.queue.splice(cmd.index, 1);
        const player = s.players.get(env.player);
        const def = DATA.units[item.unit];
        if (player && def)
          for (const [r, v] of Object.entries(def.cost))
            player.resources[r as keyof ResourceAmounts] += v ?? 0;
        if (cmd.index === 0) b.popBlocked = false;
        return;
      }
      case 'setRally': {
        const b = ownBuilding(cmd.building);
        if (!b) return reject('NOT_OWNER');
        if (!b.constructed || !DATA.buildings[b.type]?.actions.some((a) => a.type === 'setRally'))
          return reject('NOT_AVAILABLE');
        b.rally = { x: cmd.to.x, y: cmd.to.y, ...(cmd.target !== undefined ? { target: cmd.target } : {}) };
        return;
      }
      case 'build': {
        const def = DATA.buildings[cmd.building];
        const player = s.players.get(env.player);
        if (!def || !player || !inBuildMenu(cmd.building)) return reject('NOT_AVAILABLE');
        const rect = {
          x: Math.floor(cmd.at.x),
          y: Math.floor(cmd.at.y),
          w: def.footprint[0],
          h: def.footprint[1],
        };
        if (!canPlace(s, rect)) return reject('BAD_PLACEMENT');
        const short = shortOf(player.resources, def.cost);
        if (short) return reject(`NOT_ENOUGH_${short.toUpperCase()}`);
        for (const [r, v] of Object.entries(def.cost)) player.resources[r as keyof ResourceAmounts] -= v ?? 0;
        this.addBuilding(env.player, cmd.building, rect, true, false);
        clearFootprint(s, rect);
        return;
      }
      case 'cancelBuild': {
        const b = ownBuilding(cmd.building);
        if (!b || b.constructed) return reject('NOT_AVAILABLE');
        const player = s.players.get(env.player);
        const def = DATA.buildings[b.type];
        if (player && def)
          for (const [r, v] of Object.entries(def.cost))
            player.resources[r as keyof ResourceAmounts] += v ?? 0;
        s.buildings.delete(b.id);
        s.grid.unblock(b.x, b.y, b.w, b.h);
        return;
      }
      default:
        return reject('UNKNOWN_COMMAND');
    }
  }

  private giveOrder(u: Unit, order: Unit['orders'][number], queue: boolean): void {
    if (queue && u.orders.length > 0) {
      u.orders.push(order);
    } else {
      u.orders = [order];
      clearGoal(u);
    }
  }

  private orderMove(units: Unit[], to: { x: number; y: number }, queue: boolean): void {
    const target = {
      x: Math.max(0, Math.min(this.width - 0.01, to.x)),
      y: Math.max(0, Math.min(this.height - 0.01, to.y)),
    };
    const spacing = Math.max(0.62, Math.max(...units.map((u) => u.radius)) * 2.1);
    const slots = formationSlots(this.state.grid, target, units.length, spacing);
    const assignment = assignSlots(units, slots, target);
    units.forEach((u, i) => {
      const slot = slots[assignment[i] ?? -1] ?? target;
      this.giveOrder(u, { kind: 'move', x: slot.x, y: slot.y }, queue);
    });
  }

  // ---- spawning ----------------------------------------------------------------------------------

  /** Dev/test helper: place a unit directly (not used by normal gameplay). */
  debugSpawn(owner: PlayerId, type: UnitTypeId, x: number, y: number): EntityId {
    return this.addUnit(owner, type, x, y).id;
  }

  /** Dev/test helper: place a finished building. Its tiles become blocked. */
  debugBuilding(owner: PlayerId, type: string, x: number, y: number): EntityId {
    const def = DATA.buildings[type];
    if (!def) throw new Error(`Unknown building "${type}"`);
    return this.addBuilding(owner, type, { x, y, w: def.footprint[0], h: def.footprint[1] }, true, true).id;
  }

  /** Dev/test helper: add resources to a player. */
  debugGive(player: PlayerId, amounts: Partial<ResourceAmounts>): void {
    const p = this.state.players.get(player);
    if (!p) return;
    for (const [r, v] of Object.entries(amounts)) p.resources[r as keyof ResourceAmounts] += v ?? 0;
  }

  private addUnit(owner: PlayerId, type: UnitTypeId, x: number, y: number): Unit {
    const u = createUnit(this.state.nextId++, owner, type, x, y);
    this.state.units.set(u.id, u);
    return u;
  }

  private addBuilding(
    owner: PlayerId,
    type: string,
    rect: { x: number; y: number; w: number; h: number },
    block: boolean,
    constructed: boolean,
  ): Building {
    const def = DATA.buildings[type];
    if (!def) throw new Error(`Unknown building "${type}"`);
    const b: Building = {
      id: this.state.nextId++,
      owner,
      type,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      hp: constructed ? def.hp : def.hp * DATA.game.construction.startHpFraction,
      maxHp: def.hp,
      constructed,
      buildProgress: 0,
      buildTotal: buildTicks(type),
      queue: [],
      popBlocked: false,
      rally: null,
    };
    this.state.buildings.set(b.id, b);
    if (block) this.state.grid.block(b.x, b.y, b.w, b.h);
    return b;
  }

  /** Place units on free passable tiles in rings around a footprint. */
  private spawnAround(spawn: SpawnPoint, type: UnitTypeId, count: number): void {
    const { grid } = this.state;
    const used = new Set<number>(
      [...this.state.units.values()].map((u) => grid.index(Math.floor(u.x), Math.floor(u.y))),
    );
    let placed = 0;
    for (let r = 1; r < 8 && placed < count; r++) {
      for (let y = spawn.y - r; y < spawn.y + spawn.h + r && placed < count; y++) {
        for (let x = spawn.x - r; x < spawn.x + spawn.w + r && placed < count; x++) {
          const onRing =
            x === spawn.x - r ||
            y === spawn.y - r ||
            x === spawn.x + spawn.w + r - 1 ||
            y === spawn.y + spawn.h + r - 1;
          if (!onRing || !grid.isPassable(x, y) || used.has(grid.index(x, y))) continue;
          used.add(grid.index(x, y));
          this.addUnit(spawn.player, type, x + 0.5, y + 0.5);
          placed++;
        }
      }
    }
  }

  private spawnTestArmy(home: SpawnPoint, count: number): void {
    const cx = home.x + home.w / 2;
    const cy = home.y + home.h / 2;
    const dx = this.width / 2 - cx;
    const dy = this.height / 2 - cy;
    const len = Math.hypot(dx, dy) || 1;
    const center = { x: cx + (dx / len) * 8, y: cy + (dy / len) * 8 };
    const slots = formationSlots(this.state.grid, center, count, 0.8);
    slots.forEach((p, i) => this.addUnit(0, TEST_ARMY_MIX[i % TEST_ARMY_MIX.length] ?? 'militia', p.x, p.y));
  }
}

export function createGame(map: DecodedMap, options: GameOptions): Game {
  return new Game(map, options);
}
