/**
 * Match setup (docs/plans/m7-menus-art-maps.md §2.2): what the Match Setup screen produces and the
 * host turns into a match. Plain data, shared by the UI (menus) and the host (boot, URL).
 */
export interface MatchSetup {
  /** Map id from maps/index.json. */
  map: string;
  /** Machine player mode id (src/ai/profiles), or 'off' for an idle opponent. */
  opponent: string;
  /** 'scenario' = the map's ready-made battle (if it has one), 'standard' = Town Hall + start units. */
  start: 'scenario' | 'standard';
  /** Pace preset id (src/data/pace.json). */
  pace: string;
  /** Game speed (time scale), one of GAME_SPEEDS. */
  speed: number;
}

/** Game speeds offered in Match Setup and in the match (+ / -). */
export const GAME_SPEEDS: readonly number[] = [0.5, 1, 1.5, 2];

/** The opponent id that means "no machine player". */
export const IDLE_OPPONENT = 'off';

/** "1.5×" */
export function formatSpeed(speed: number): string {
  return `${speed}×`;
}

/** The nearest offered game speed. */
export function clampSpeed(speed: number): number {
  let best = 1;
  for (const s of GAME_SPEEDS) if (Math.abs(s - speed) < Math.abs(best - speed)) best = s;
  return best;
}
