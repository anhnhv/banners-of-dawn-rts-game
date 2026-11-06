/**
 * The authoritative game (PLAN §5). Fixed 20 Hz ticks, deterministic for a given map, seed and
 * command log. The host feeds it commands and calls step(); the UI reads getView().
 */
import {
  Rng,
  type Command,
  type CommandEnvelope,
  type DecodedMap,
  type EntityId,
  type GameEvent,
  type PlayerId,
  type PlayerView,
  type UnitTypeId,
  type UnitView,
} from '../shared';
import { clearPath, createUnit, type Unit } from './entities/Unit';
import type { GameState } from './GameState';
import { loadMap, type LoadedMap, type SpawnPoint } from './map/loadMap';
import { PathFinder } from './path/astar';
import { assignSlots, formationSlots } from './path/groupMove';
import { SpatialHash } from './spatial/SpatialHash';
import { movementSystem, orderSystem, pathfindingSystem, separationSystem } from './systems/movement';

export interface GameOptions {
  seed: number;
  /** Dev/testing: spawn this many extra units for the human player in front of their base. */
  testArmy?: number;
}

const START_UNIT_IDS = new Set<string>(['worker', 'militia', 'archer', 'scout_rider', 'knight', 'catapult']);
const TEST_ARMY_MIX: UnitTypeId[] = ['militia', 'militia', 'archer', 'knight', 'worker', 'scout_rider'];

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
      units: new Map(),
      nextId: 1,
      pathFinder: new PathFinder(grid),
      pathQueue: [],
      spatial: new SpatialHash<Unit>(1),
    };
    for (const spawn of this.loaded.spawns) {
      for (const [type, count] of map.startUnits) {
        if (START_UNIT_IDS.has(type)) this.spawnAround(spawn, type as UnitTypeId, count);
      }
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

  /** Queue a command; it is applied at the start of the first step with tick ≥ env.tick. */
  enqueue(env: CommandEnvelope): void {
    this.pending.push(env);
  }

  /** Advance exactly one tick. Returns the events that happened during it. */
  step(): GameEvent[] {
    const s = this.state;
    const events: GameEvent[] = [];
    for (const u of s.units.values()) {
      u.prevX = u.x;
      u.prevY = u.y;
    }

    // 1. commands due this tick, in arrival order
    const due = this.pending.filter((c) => c.tick <= s.tick);
    if (due.length > 0) {
      this.pending.splice(0, this.pending.length, ...this.pending.filter((c) => c.tick > s.tick));
      for (const env of due) this.apply(env, events);
    }

    // 4–7. orders → paths → movement → separation
    orderSystem(s);
    pathfindingSystem(s);
    movementSystem(s);
    separationSystem(s);

    s.tick++;
    this.viewCache.clear();
    return events;
  }

  getView(player: PlayerId): PlayerView {
    const cached = this.viewCache.get(player);
    if (cached) return cached;
    const units: UnitView[] = [];
    for (const u of this.state.units.values()) {
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
        radius: u.radius,
        hp: u.hp,
        maxHp: u.maxHp,
      });
    }
    const view: PlayerView = { tick: this.state.tick, player, units };
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
    }
    return (h >>> 0).toString(16);
  }

  // ---- commands ----------------------------------------------------------------------------------

  private apply(env: CommandEnvelope, events: GameEvent[]): void {
    const reject = (reason: string): void => {
      events.push({ type: 'commandRejected', player: env.player, reason });
    };
    const cmd: Command = env.cmd;
    const own = (ids: readonly EntityId[]): Unit[] =>
      ids.map((id) => this.state.units.get(id)).filter((u): u is Unit => !!u && u.owner === env.player);

    switch (cmd.type) {
      case 'move': {
        const units = own(cmd.units);
        if (units.length === 0) return reject('NO_UNITS');
        if (!Number.isFinite(cmd.to.x) || !Number.isFinite(cmd.to.y)) return reject('BAD_TARGET');
        const target = {
          x: Math.max(0, Math.min(this.width - 0.01, cmd.to.x)),
          y: Math.max(0, Math.min(this.height - 0.01, cmd.to.y)),
        };
        const spacing = Math.max(0.62, Math.max(...units.map((u) => u.radius)) * 2.1);
        const slots = formationSlots(this.state.grid, target, units.length, spacing);
        const assignment = assignSlots(units, slots, target);
        units.forEach((u, i) => {
          const slot = slots[assignment[i] ?? -1] ?? target;
          const order = { kind: 'move' as const, x: slot.x, y: slot.y };
          if (cmd.queue && u.orders.length > 0) {
            u.orders.push(order);
          } else {
            u.orders = [order];
            clearPath(u);
            u.pathPending = false;
            u.repaths = 0;
          }
        });
        return;
      }
      case 'stop': {
        const units = own(cmd.units);
        if (units.length === 0) return reject('NO_UNITS');
        for (const u of units) {
          u.orders = [];
          clearPath(u);
          u.pathPending = false;
        }
        return;
      }
      default:
        return reject('UNKNOWN_COMMAND');
    }
  }

  // ---- spawning ----------------------------------------------------------------------------------

  /** Dev/test helper: place a unit directly (not used by normal gameplay). */
  debugSpawn(owner: PlayerId, type: UnitTypeId, x: number, y: number): EntityId {
    return this.addUnit(owner, type, x, y).id;
  }

  private addUnit(owner: PlayerId, type: UnitTypeId, x: number, y: number): Unit {
    const u = createUnit(this.state.nextId++, owner, type, x, y);
    this.state.units.set(u.id, u);
    return u;
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
    // in front of the base, toward the map center
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
