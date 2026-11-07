/** Everything the systems read and write during a tick. */
import type { EntityId, GameEvent, PlayerId, ResourceAmounts, ResourceView, Rng } from '../shared';
import type { Building, ResourceNode } from './entities/Building';
import type { Projectile } from './entities/Projectile';
import type { Unit } from './entities/Unit';
import type { Grid } from './map/Grid';
import type { PathFinder } from './path/astar';
import type { SpatialHash } from './spatial/SpatialHash';

export interface PlayerState {
  id: PlayerId;
  resources: ResourceAmounts;
  /** Last tick an `underAttack` event was sent to this player. */
  lastAlertTick: number;
}

export interface GameState {
  tick: number;
  grid: Grid;
  rng: Rng;
  players: Map<PlayerId, PlayerState>;
  /** All entities by id (insertion order = id order, which keeps iteration deterministic). */
  units: Map<EntityId, Unit>;
  buildings: Map<EntityId, Building>;
  projectiles: Map<EntityId, Projectile>;
  nodes: Map<EntityId, ResourceNode>;
  /** Live views of the nodes (same objects every tick; amounts updated in place). */
  nodeViews: Map<EntityId, ResourceView>;
  nodesVersion: number;
  nextId: number;
  pathFinder: PathFinder;
  /** Units waiting for a path, first come first served. */
  pathQueue: EntityId[];
  spatial: SpatialHash<Unit>;
  /** Events produced during the current tick. */
  events: GameEvent[];
}
