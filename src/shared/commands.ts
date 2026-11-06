/**
 * Commands (PLAN §4.1): the ONLY way the human UI and the machine player act on the game.
 * Positions are grid space (tile units, floats). More command types arrive with later milestones.
 */
import type { EntityId, PlayerId } from './ids';

export interface WorldPos {
  x: number;
  y: number;
}

export type Command =
  { type: 'move'; units: EntityId[]; to: WorldPos; queue?: boolean } | { type: 'stop'; units: EntityId[] };

export type CommandType = Command['type'];

export interface CommandEnvelope {
  player: PlayerId;
  /** Tick at which the command should be applied (applied at the first step with tick ≥ this). */
  tick: number;
  cmd: Command;
}

export type RejectReason = 'NOT_OWNER' | 'NO_UNITS' | 'BAD_TARGET' | 'UNKNOWN_COMMAND';
