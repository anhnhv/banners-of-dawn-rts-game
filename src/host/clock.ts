/** Fixed-step clock used by the host loop (PLAN §10). */
import { TICK_MS } from '../shared';

/**
 * Fixed-step accumulator: turns variable frame times into a whole number of simulation ticks.
 * Caps the number of ticks per frame so a long stall (tab in background) can't freeze the game.
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
    if (steps > this.maxStepsPerFrame) {
      steps = this.maxStepsPerFrame;
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
