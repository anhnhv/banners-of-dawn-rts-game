/**
 * PlayerView (PLAN §5.8): the read-only picture of the game that the UI draws.
 * Built by the engine once per tick. Fog of war filtering arrives in M7; until then it contains everything.
 */
import type { EntityId, PlayerId } from './ids';

export type UnitTypeId = 'worker' | 'militia' | 'archer' | 'scout_rider' | 'knight' | 'catapult';

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
  radius: number;
  hp: number;
  maxHp: number;
}

export interface GameEvent {
  type: 'commandRejected';
  player: PlayerId;
  reason: string;
}

export interface PlayerView {
  tick: number;
  player: PlayerId;
  units: readonly UnitView[];
}
