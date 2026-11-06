/**
 * Commands (PLAN §4.1): the ONLY way the human UI and the machine player act on the game.
 * Positions are grid space (tile units, floats).
 *
 * `interact` is the generic right-click: the engine decides from the game data what each unit can
 * do with the target (gather a resource, drop off at a building, … attack/build in later milestones).
 */
import type { EntityId, PlayerId } from './ids';

export interface WorldPos {
  x: number;
  y: number;
}

export type Command =
  | { type: 'move'; units: EntityId[]; to: WorldPos; queue?: boolean }
  | { type: 'interact'; units: EntityId[]; target: EntityId; queue?: boolean }
  | { type: 'stop'; units: EntityId[] }
  | { type: 'train'; building: EntityId; unit: string }
  | { type: 'cancelTrain'; building: EntityId; index: number }
  | { type: 'setRally'; building: EntityId; to: WorldPos; target?: EntityId };

export type CommandType = Command['type'];

export interface CommandEnvelope {
  player: PlayerId;
  /** Tick at which the command should be applied (applied at the first step with tick ≥ this). */
  tick: number;
  cmd: Command;
}

export type RejectReason =
  | 'NOT_OWNER'
  | 'NO_UNITS'
  | 'BAD_TARGET'
  | 'UNKNOWN_COMMAND'
  | 'NOT_AVAILABLE'
  | 'QUEUE_FULL'
  | 'NOT_ENOUGH_FOOD'
  | 'NOT_ENOUGH_WOOD'
  | 'NOT_ENOUGH_GOLD';
