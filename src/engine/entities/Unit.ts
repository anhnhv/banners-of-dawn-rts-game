/** Unit entity (PLAN §5.2). Plain data; systems mutate it once per tick. Stats come from units.json. */
import type { EntityId, PlayerId, ResourceType, UnitActivity, UnitTypeId } from '../../shared';
import { DATA } from '../data';
import type { Point } from '../path/smoothing';

export type GatherPhase = 'toNode' | 'harvest';

export type Order =
  | { kind: 'move'; x: number; y: number }
  /** Harvest `target` straight into the stockpile; retargets nodes of the same resource when it runs out. */
  | {
      kind: 'gather';
      target: EntityId;
      resource: ResourceType;
      phase: GatherPhase;
      lastX: number;
      lastY: number;
    };

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
  pop: number;
  /** orders[0] is the current order; the rest were queued with shift. */
  orders: Order[];
  activity: UnitActivity;
  /** Fractional harvest progress toward the next whole resource unit. */
  workProgress: number;

  // ---- movement (driven by the current order through `goal`) ----
  goal: Point | null;
  /** Waypoints toward the goal (index 0 is where the path started). */
  path: Point[] | null;
  pathIndex: number;
  pathPending: boolean;
  moving: boolean;
  /** The goal was reached (or given up on: see `blocked`). */
  arrived: boolean;
  blocked: boolean;
  /** Stuck detection: best distance to the current waypoint and ticks without progress. */
  bestDist: number;
  stuckTicks: number;
  repaths: number;
}

export function createUnit(id: EntityId, owner: PlayerId, type: UnitTypeId, x: number, y: number): Unit {
  const def = DATA.units[type];
  if (!def) throw new Error(`Unknown unit type "${type}"`);
  return {
    id,
    owner,
    type,
    x,
    y,
    prevX: x,
    prevY: y,
    radius: def.radius,
    speed: def.speed,
    facing: owner === 0 ? Math.PI : 0,
    hp: def.hp,
    maxHp: def.hp,
    pop: def.pop,
    orders: [],
    activity: 'idle',
    workProgress: 0,
    goal: null,
    path: null,
    pathIndex: 0,
    pathPending: false,
    moving: false,
    arrived: false,
    blocked: false,
    bestDist: Infinity,
    stuckTicks: 0,
    repaths: 0,
  };
}

/** Forget the current path (keeps the goal and the orders). */
export function clearPath(u: Unit): void {
  u.path = null;
  u.pathIndex = 0;
  u.moving = false;
  u.bestDist = Infinity;
  u.stuckTicks = 0;
}

/** Gather rate (per second) of this unit type for a node kind, or 0 if it cannot gather it. */
export function gatherRate(type: UnitTypeId, nodeKind: string): number {
  return DATA.units[type]?.interactions.gather?.targets[nodeKind] ?? 0;
}
