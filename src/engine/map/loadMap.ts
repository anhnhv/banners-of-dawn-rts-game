/**
 * Turn a decoded map into the engine's starting state: the Grid with every static blocker placed,
 * the resource nodes (with amounts from data or map overrides), and the two spawns.
 * Entities (Town Halls, starting units) are created from this in M2.
 */
import {
  RESOURCE_KINDS,
  type DecodedMap,
  type MapObject,
  type MapObjectKind,
  type PlayerId,
} from '../../shared';
import resourceData from '../../data/resources.json';
import { Grid } from './Grid';

export type ResourceKind = Extract<MapObjectKind, 'tree' | 'pine' | 'gold_mine' | 'berry_bush'>;
export type ResourceType = 'food' | 'wood' | 'gold';

export interface ResourceNodeSpawn {
  kind: ResourceKind;
  resource: ResourceType;
  x: number;
  y: number;
  w: number;
  h: number;
  amount: number;
}

export interface SpawnPoint {
  player: PlayerId;
  /** Top-left tile of the Town Hall footprint (3×3). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LoadedMap {
  map: DecodedMap;
  grid: Grid;
  resources: ResourceNodeSpawn[];
  spawns: SpawnPoint[];
}

const NODES: Record<ResourceKind, { resource: string; amount: number }> = resourceData.nodes;

export function isResourceKind(kind: MapObjectKind): kind is ResourceKind {
  return RESOURCE_KINDS.has(kind);
}

export function resourceNodeFor(o: MapObject & { kind: ResourceKind }): ResourceNodeSpawn {
  const node = NODES[o.kind];
  return {
    kind: o.kind,
    resource: node.resource as ResourceType,
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h,
    amount: o.amount ?? node.amount,
  };
}

export function loadMap(map: DecodedMap): LoadedMap {
  const grid = new Grid(map.width, map.height, map.terrain);
  const resources: ResourceNodeSpawn[] = [];
  const spawns: SpawnPoint[] = [];

  for (const o of map.objects) {
    if (o.kind === 'spawn') {
      spawns.push({ player: o.player ?? 0, x: o.x, y: o.y, w: o.w, h: o.h });
      grid.block(o.x, o.y, o.w, o.h); // the Town Hall stands here
    } else if (isResourceKind(o.kind)) {
      resources.push(resourceNodeFor({ ...o, kind: o.kind }));
      grid.block(o.x, o.y, o.w, o.h);
    } else {
      // 'stone' is decoration: it blocks movement but cannot be gathered.
      grid.block(o.x, o.y, o.w, o.h);
    }
  }
  spawns.sort((a, b) => a.player - b.player);
  return { map, grid, resources, spawns };
}
