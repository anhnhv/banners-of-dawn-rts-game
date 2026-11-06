/** Buildings and resource nodes (PLAN §5.2): entities with a footprint on the grid. */
import type { BuildingTypeId, EntityId, NodeKind, PlayerId, ResourceType, UnitTypeId } from '../../shared';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface QueueItem {
  unit: UnitTypeId;
  /** Ticks of work done and needed. */
  progress: number;
  total: number;
}

export interface Building extends Rect {
  id: EntityId;
  owner: PlayerId;
  type: BuildingTypeId;
  hp: number;
  maxHp: number;
  queue: QueueItem[];
  /** First queue item is done but there is no population room yet. */
  popBlocked: boolean;
  rally: { x: number; y: number; target?: EntityId } | null;
}

export interface ResourceNode extends Rect {
  id: EntityId;
  kind: NodeKind;
  resource: ResourceType;
  amount: number;
}
