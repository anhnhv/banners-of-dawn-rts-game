/**
 * What the game shows any machine player (PLAN §6, docs/plans/m6-vs-machine.md): the static map
 * info at the start and an Observation each time it thinks. The game engine builds these
 * (Game.staticInfo / Game.observe); the AI module (top-level ai/) reads them and owns everything
 * else about itself (its contract, worker messages and settings schema).
 * Everything here is plain data (arrays and objects only) so it can be posted to a Web Worker.
 * Decision 2026-11-07: there is no fog of war, so the observation contains every entity.
 */
import type { GameData, ResourceAmounts, ResourceType, Stance } from './gameData';
import type { EntityId, PlayerId } from './ids';
import type { BuildingTypeId, GameEvent, NodeKind, UnitTypeId } from './view';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Sent once at the start: the map and the game rules. */
export interface StaticMapInfo {
  player: PlayerId;
  width: number;
  height: number;
  tickRate: number;
  /** Row-major, 1 = a building may stand here as far as terrain and static rocks go. */
  buildable: number[];
  /** Row-major, 1 = units can walk here as far as terrain and static rocks go. */
  passable: number[];
  spawns: Array<Rect & { player: PlayerId }>;
  /** The full parsed game config (units, buildings, rules). */
  data: GameData;
}

/** A unit's current order, summarized. */
export type UnitOrderInfo =
  | { kind: 'idle' }
  | { kind: 'move'; x: number; y: number }
  | { kind: 'attackMove'; x: number; y: number }
  | { kind: 'gather'; node: EntityId; resource: ResourceType }
  | { kind: 'attack'; target: EntityId; auto: boolean };

export interface ObservedUnit {
  id: EntityId;
  owner: PlayerId;
  type: UnitTypeId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  stance: Stance;
  order: UnitOrderInfo;
}

export interface ObservedBuilding extends Rect {
  id: EntityId;
  owner: PlayerId;
  type: BuildingTypeId;
  hp: number;
  maxHp: number;
  constructed: boolean;
  /** Unit types waiting in the production queue (first = in production). */
  queue: UnitTypeId[];
  rally: { x: number; y: number } | null;
  /** Workers gathering from it now (buildings with `gather`, e.g. a Farm; else 0). */
  gatherers: number;
}

export interface ObservedNode extends Rect {
  id: EntityId;
  kind: NodeKind;
  resource: ResourceType;
  amount: number;
}

/** What the machine player sees each time it thinks. */
export interface Observation {
  tick: number;
  player: PlayerId;
  resources: ResourceAmounts;
  pop: number;
  popCap: number;
  units: ObservedUnit[];
  buildings: ObservedBuilding[];
  /** Live resource nodes. */
  nodes: ObservedNode[];
  /** Events since the previous observation. */
  events: GameEvent[];
  over: boolean;
}
