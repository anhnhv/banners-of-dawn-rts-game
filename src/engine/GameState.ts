/** Everything the systems read and write during a tick. */
import type { EntityId, Rng } from '../shared';
import type { Unit } from './entities/Unit';
import type { Grid } from './map/Grid';
import type { PathFinder } from './path/astar';
import type { SpatialHash } from './spatial/SpatialHash';

export interface GameState {
  tick: number;
  grid: Grid;
  rng: Rng;
  /** All units by id (insertion order = id order, which keeps iteration deterministic). */
  units: Map<EntityId, Unit>;
  nextId: number;
  pathFinder: PathFinder;
  /** Units waiting for a path, first come first served. */
  pathQueue: EntityId[];
  spatial: SpatialHash<Unit>;
}
