/**
 * GAME ENGINE: public API
 * Authoritative, deterministic simulation on a square tile grid (PLAN §5).
 * Rules: imports only src/shared and src/data; no DOM, no network, no Math.random/Date.
 * The 3D view is a UI concern; the engine never knows about it.
 *
 * Only this file is the engine's public surface; src/host imports from here, nothing else does.
 */
import { TICK_RATE } from '../shared';

export const ENGINE_INFO = {
  name: 'Banners of Dawn engine',
  tickRate: TICK_RATE,
} as const;

export { Grid, TERRAIN_RULES, type TerrainRule } from './map/Grid';
export {
  loadMap,
  type LoadedMap,
  type ResourceKind,
  type ResourceNodeSpawn,
  type ResourceType,
  type SpawnPoint,
} from './map/loadMap';
export { validateMap, RULES as MAP_RULES, type SpawnSummary, type ValidationResult } from './map/validateMap';
