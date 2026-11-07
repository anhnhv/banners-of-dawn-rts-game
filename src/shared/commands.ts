/**
 * Commands (PLAN §4.1): the ONLY way the human UI and the machine player act on the game.
 * Positions are grid space (tile units, floats).
 *
 * `interact` is the generic right-click: the engine decides from the game data what each unit can
 * do with the target (gather a resource, attack an enemy unit or building, …).
 */
import type { Stance } from './gameData';
import type { EntityId, PlayerId } from './ids';

export interface WorldPos {
  x: number;
  y: number;
}

export type Command =
  | { type: 'move'; units: EntityId[]; to: WorldPos; queue?: boolean }
  | { type: 'interact'; units: EntityId[]; target: EntityId; queue?: boolean }
  | { type: 'stop'; units: EntityId[] }
  /** Move, but fight every enemy met on the way, then continue. */
  | { type: 'attackMove'; units: EntityId[]; to: WorldPos; queue?: boolean }
  | { type: 'setStance'; units: EntityId[]; stance: Stance }
  | { type: 'train'; building: EntityId; unit: string }
  | { type: 'cancelTrain'; building: EntityId; index: number }
  | { type: 'setRally'; building: EntityId; to: WorldPos; target?: EntityId }
  /** Place a construction site (top-left tile `at`). No workers needed: it builds itself. */
  | { type: 'build'; building: string; at: { x: number; y: number } }
  /** Cancel a construction site for a full refund. */
  | { type: 'cancelBuild'; building: EntityId };

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
  | 'NOT_ENOUGH_GOLD'
  | 'BAD_PLACEMENT';
