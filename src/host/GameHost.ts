/**
 * GameHost (PLAN §10): owns the fixed-step loop. Every animation frame it advances the engine by
 * a whole number of 20 Hz ticks (scaled by game speed), feeds the player's commands in at the
 * current tick, and lets the screen render with the interpolation alpha.
 * The machine player's controller joins here in M8.
 */
import type { Command, CommandEnvelope, PlayerId } from '../shared';
import type { Game } from '../engine';
import type { GameScreen } from '../ui';
import { FixedStepClock } from './clock';

export class GameHost {
  /** Game speed multiplier (1 = normal). */
  speed = 1;
  paused = false;
  /** Every command applied so far, tick-stamped (replays later). */
  readonly commandLog: CommandEnvelope[] = [];

  private readonly clock = new FixedStepClock();
  private readonly incoming: Command[] = [];
  private screen: GameScreen | null = null;
  private last = 0;
  private rafId = 0;

  constructor(
    private readonly game: Game,
    private readonly player: PlayerId,
  ) {}

  attach(screen: GameScreen): void {
    this.screen = screen;
  }

  /** A command from the human player's UI; applied at the next tick. */
  issue(cmd: Command): void {
    this.incoming.push(cmd);
  }

  start(): void {
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  private readonly frame = (now: number): void => {
    const dtMs = this.last === 0 ? 0 : Math.min(now - this.last, 250);
    this.last = now;
    const { steps, alpha } = this.clock.advance(dtMs, this.paused ? 0 : this.speed);
    for (let i = 0; i < steps; i++) {
      while (this.incoming.length > 0) {
        const env: CommandEnvelope = {
          player: this.player,
          tick: this.game.tick,
          cmd: this.incoming.shift() as Command,
        };
        this.commandLog.push(env);
        this.game.enqueue(env);
      }
      for (const ev of this.game.step()) {
        if (ev.type === 'commandRejected' && ev.player === this.player)
          console.info(`[game] command rejected: ${ev.reason}`);
      }
    }
    this.screen?.frame(dtMs / 1000, this.game.getView(this.player), alpha);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
