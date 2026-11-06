/** Simulation ticks per second (PLAN §5.1). */
export const TICK_RATE = 20;

/** Milliseconds of game time per simulation tick. */
export const TICK_MS = 1000 / TICK_RATE;

/** Convert seconds (as written in data files) to whole simulation ticks. */
export function secondsToTicks(seconds: number): number {
  return Math.max(0, Math.round(seconds * TICK_RATE));
}
