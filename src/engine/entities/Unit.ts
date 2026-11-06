/** Unit entity (PLAN §5.2). Plain data; systems mutate it once per tick. */
import type { EntityId, PlayerId, UnitTypeId } from '../../shared';
import type { Point } from '../path/smoothing';
import unitData from '../../data/units.json';

export interface UnitStats {
  name: string;
  class: string;
  hp: number;
  armor: number;
  speed: number;
  sight: number;
  radius: number;
}

export const UNIT_STATS: Record<UnitTypeId, UnitStats> = unitData.units;

export type Order = { kind: 'move'; x: number; y: number };

export interface Unit {
  id: EntityId;
  owner: PlayerId;
  type: UnitTypeId;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  radius: number;
  /** Tiles per second. */
  speed: number;
  facing: number;
  hp: number;
  maxHp: number;
  /** orders[0] is the current order; the rest were queued with shift. */
  orders: Order[];
  /** Waypoints of the current move (index 0 is where the path started). */
  path: Point[] | null;
  pathIndex: number;
  pathPending: boolean;
  moving: boolean;
  /** Stuck detection: best distance to the current waypoint and ticks without progress. */
  bestDist: number;
  stuckTicks: number;
  repaths: number;
}

export function createUnit(id: EntityId, owner: PlayerId, type: UnitTypeId, x: number, y: number): Unit {
  const stats = UNIT_STATS[type];
  return {
    id,
    owner,
    type,
    x,
    y,
    prevX: x,
    prevY: y,
    radius: stats.radius,
    speed: stats.speed,
    facing: owner === 0 ? Math.PI : 0,
    hp: stats.hp,
    maxHp: stats.hp,
    orders: [],
    path: null,
    pathIndex: 0,
    pathPending: false,
    moving: false,
    bestDist: Infinity,
    stuckTicks: 0,
    repaths: 0,
  };
}

/** Forget the current path (keeps the orders). */
export function clearPath(u: Unit): void {
  u.path = null;
  u.pathIndex = 0;
  u.moving = false;
  u.bestDist = Infinity;
  u.stuckTicks = 0;
}
