/** Unique id of an entity within one match. Never reused. */
export type EntityId = number;

/** 1v1 only: player 0 is the human, player 1 is the machine player. */
export type PlayerId = 0 | 1;

export const HUMAN_PLAYER: PlayerId = 0;
export const MACHINE_PLAYER: PlayerId = 1;

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 0 ? 1 : 0;
}
