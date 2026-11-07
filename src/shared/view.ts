/**
 * PlayerView (PLAN §5.8): the read-only picture of the game that the UI draws.
 * Built by the engine once per tick. Fog of war filtering arrives in M7; until then it contains everything.
 */
import type { ResourceAmounts, ResourceType } from './gameData';
import type { EntityId, PlayerId } from './ids';

/** Unit type id: a key of src/data/units.json. */
export type UnitTypeId = string;
/** Building type id: a key of src/data/buildings.json. */
export type BuildingTypeId = string;
/** Resource node kind: a key of resources.json → nodes. */
export type NodeKind = string;

/** What a unit is doing, for animation and the info panel. */
export type UnitActivity = 'idle' | 'walk' | 'work';

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
  | { type: 'resourceDepleted'; node: EntityId };

export interface PlayerView {
  tick: number;
  player: PlayerId;
  self: { resources: ResourceAmounts; pop: number; popCap: number };
  units: readonly UnitView[];
  buildings: readonly BuildingView[];
  /** Live resource nodes by id (shared with the engine; read only). */
  resources: ReadonlyMap<EntityId, ResourceView>;
  /** Increases whenever a node disappears, so the UI only re-checks nodes when needed. */
  resourcesVersion: number;
}
