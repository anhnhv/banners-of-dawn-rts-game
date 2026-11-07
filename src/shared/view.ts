/**
 * PlayerView (PLAN §5.8): the read-only picture of the game that the UI draws.
 * Built by the engine once per tick. There is no fog of war: it contains everything (decision 2026-11-07).
 */
import type { ResourceAmounts, ResourceType, Stance } from './gameData';
import type { EntityId, PlayerId } from './ids';

/** Unit type id: a key of src/data/units.json. */
export type UnitTypeId = string;
/** Building type id: a key of src/data/buildings.json. */
export type BuildingTypeId = string;
/** Resource node kind: a key of resources.json → nodes. */
export type NodeKind = string;

/** What a unit is doing, for animation and the info panel. */
export type UnitActivity = 'idle' | 'walk' | 'work' | 'attack';

export interface UnitView {
  id: EntityId;
  owner: PlayerId;
  type: UnitTypeId;
  /** Position now and at the previous tick (grid space), for interpolation. */
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** Facing angle in radians: atan2(dx, dy) in grid space (0 = +y). */
  facing: number;
  moving: boolean;
  activity: UnitActivity;
  /** Short description of the current order, e.g. "Gathering wood". */
  task: string;
  hasOrders: boolean;
  radius: number;
  hp: number;
  maxHp: number;
  stance: Stance;
  /** Tick of the last strike (melee hit or shot), -1 if none: drives the strike animation. */
  strikeTick: number;
}

export interface QueueItemView {
  unit: UnitTypeId;
  /** 0..1 */
  progress: number;
}

export interface BuildingView {
  id: EntityId;
  owner: PlayerId;
  type: BuildingTypeId;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  /** False while it is still a construction site. */
  constructed: boolean;
  /** Construction progress 0..1 (1 when finished). */
  buildProgress: number;
  queue: readonly QueueItemView[];
  /** True while the first queue item is finished but waiting for population room. */
  popBlocked: boolean;
  rally: { x: number; y: number; target?: EntityId } | null;
}

/** A projectile in flight (grid space; z = height above the ground). */
export interface ProjectileView {
  id: EntityId;
  /** projectiles.json key. */
  kind: string;
  owner: PlayerId;
  x: number;
  y: number;
  z: number;
  prevX: number;
  prevY: number;
  prevZ: number;
}

export interface ResourceView {
  id: EntityId;
  kind: NodeKind;
  resource: ResourceType;
  x: number;
  y: number;
  w: number;
  h: number;
  amount: number;
}

export type GameEvent =
  | { type: 'commandRejected'; player: PlayerId; reason: string }
  | { type: 'unitTrained'; player: PlayerId; unit: EntityId; unitType: UnitTypeId }
  | { type: 'popCapped'; player: PlayerId; building: EntityId }
  | { type: 'buildingCompleted'; player: PlayerId; building: EntityId; buildingType: BuildingTypeId }
  | { type: 'resourceDepleted'; node: EntityId }
  | {
      type: 'unitDied';
      unit: EntityId;
      unitType: UnitTypeId;
      owner: PlayerId;
      x: number;
      y: number;
      facing: number;
    }
  | {
      type: 'buildingDestroyed';
      building: EntityId;
      buildingType: BuildingTypeId;
      owner: PlayerId;
      x: number;
      y: number;
      w: number;
      h: number;
    }
  /** Throttled per player (game.json → combat.underAttackAlertSeconds). */
  | { type: 'underAttack'; player: PlayerId; x: number; y: number }
  /** The match is over (game.json → victory). winner null = draw (both lost in the same tick). */
  | { type: 'gameOver'; winner: PlayerId | null };

/** Per-player match statistics (result screen). */
export interface PlayerStats {
  unitsTrained: number;
  unitsLost: number;
  buildingsBuilt: number;
  buildingsLost: number;
}

export interface MatchResult {
  /** null = draw. */
  winner: PlayerId | null;
  /** Tick at which the match ended. */
  tick: number;
  /** Indexed by player id. */
  stats: PlayerStats[];
}

export interface PlayerView {
  tick: number;
  player: PlayerId;
  self: { resources: ResourceAmounts; pop: number; popCap: number };
  units: readonly UnitView[];
  buildings: readonly BuildingView[];
  projectiles: readonly ProjectileView[];
  /** Live resource nodes by id (shared with the engine; read only). */
  resources: ReadonlyMap<EntityId, ResourceView>;
  /** Increases whenever a node disappears, so the UI only re-checks nodes when needed. */
  resourcesVersion: number;
  /** Set once the match is over; the simulation is frozen from then on. */
  result: MatchResult | null;
}
