/** Fixed-step clock used by the host loop (PLAN §10). */
import { TICK_MS } from '../shared';

/**
 * Fixed-step accumulator: turns variable frame times into a whole number of simulation ticks.
 * Caps the number of ticks per frame so a long stall (tab in background) can't freeze the game.
 * The cap grows with the game speed (`maxStepsPerFrame` × speed), so a fast game speed (8× = 160
 * ticks/s) still runs at full speed on a slow frame rate.
 */
export class FixedStepClock {
  private accumulator = 0;

  constructor(
    private readonly maxStepsPerFrame = 5,
    private readonly tickMs = TICK_MS,
  ) {}

  /**
   * Advance by `elapsedMs` of real time scaled by `speed`.
   * @returns number of ticks to simulate this frame and the interpolation alpha in [0, 1).
   */
  advance(elapsedMs: number, speed = 1): { steps: number; alpha: number } {
    this.accumulator += Math.max(0, elapsedMs) * speed;
    let steps = Math.floor(this.accumulator / this.tickMs);
    const cap = Math.max(this.maxStepsPerFrame, Math.ceil(this.maxStepsPerFrame * speed));
    if (steps > cap) {
      steps = cap;
      this.accumulator = 0;
    } else {
      this.accumulator -= steps * this.tickMs;
    }
    return { steps, alpha: this.accumulator / this.tickMs };
  }

  reset(): void {
    this.accumulator = 0;
  }
}
