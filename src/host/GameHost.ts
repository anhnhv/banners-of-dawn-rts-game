/**
 * GameHost (PLAN §10): owns the fixed-step loop. Every animation frame it advances the engine by
 * a whole number of 20 Hz ticks (scaled by game speed), feeds the player's commands in at the
 * current tick, and lets the screen render with the interpolation alpha.
 * The machine player's controller (aiController.ts) is called after every tick; its commands go
 * through the same command log as the human's.
 */
import type { Command, CommandEnvelope, GameEvent, PlayerId } from '../shared';
import type { Game } from '../engine';
import type { GameScreen } from '../ui';
import type { AIController } from './aiController';
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
  private ai: AIController | null = null;

  constructor(
    private readonly game: Game,
    private readonly player: PlayerId,
  ) {}

  /** Let a machine player control its side. */
  attachAI(ai: AIController): void {
    this.ai = ai;
  }

  /** Where the machine player's commands go: logged, then queued for their tick. */
  readonly aiSink = (env: CommandEnvelope): void => {
    this.commandLog.push(env);
    this.game.enqueue(env);
  };

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
    const events: GameEvent[] = [];
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
      const stepEvents = this.game.step();
      events.push(...stepEvents);
      this.ai?.afterStep(stepEvents);
    }
    if (this.ai && this.game.result) {
      this.ai.dispose();
      this.screen?.setOpponentStatus(`${this.ai.status()} · match over`);
      this.ai = null;
    } else if (this.ai) this.screen?.setOpponentStatus(this.ai.status());
    this.screen?.frame(dtMs / 1000, this.game.getView(this.player), alpha, events);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
