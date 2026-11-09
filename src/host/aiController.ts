/**
 * Machine-player controllers (PLAN §6.1). The host calls afterStep() after every engine tick.
 *  - InlineAIController runs the AIPlayer synchronously: deterministic, used by tests and tools.
 *  - WorkerAIController runs it in a Web Worker (the browser default), so thinking never stalls
 *    the frame. Its commands are applied at the tick they were meant for, or at once if they
 *    arrive late; the host logs them like the human's.
 * Both take the profile (settings) the AI plays with, e.g. a difficulty mode from src/ai/profiles.
 */
import {
  aiTicks,
  createAIPlayer,
  type AIPlayer,
  type AIProfile,
  type FromAIMessage,
  type ToAIMessage,
} from '../../ai';
import type { Game } from '../engine';
import type { Command, CommandEnvelope, GameEvent, PlayerId } from '../shared';

export interface AIController {
  readonly player: PlayerId;
  afterStep(events: readonly GameEvent[]): void;
  /** One line describing what the AI is doing. */
  status(): string;
  dispose(): void;
}

type Sink = (env: CommandEnvelope) => void;

/** Only the events a player should hear about. */
function forPlayer(player: PlayerId, events: readonly GameEvent[]): GameEvent[] {
  return events.filter((e) => !('player' in e) || e.player === player);
}

export class InlineAIController implements AIController {
  private readonly ai: AIPlayer = createAIPlayer();
  private events: GameEvent[] = [];
  private next = 0;

  constructor(
    private readonly game: Game,
    readonly player: PlayerId,
    profile: AIProfile,
    private readonly sink: Sink = (env) => game.enqueue(env),
    seed = 1,
  ) {
    this.ai.init(game.staticInfo(player), profile, seed);
  }

  afterStep(events: readonly GameEvent[]): void {
    this.events.push(...forPlayer(this.player, events));
    if (this.game.tick < this.next) return;
    this.next = this.game.tick + this.ai.thinkTicks;
    const obs = this.game.observe(this.player, this.events);
    this.events = [];
    const tick = obs.tick + this.ai.delayTicks;
    for (const cmd of this.ai.think(obs)) this.sink({ player: this.player, tick, cmd });
  }

  status(): string {
    return this.ai.debugText();
  }

  dispose(): void {}
}

export class WorkerAIController implements AIController {
  private readonly worker: Worker;
  private events: GameEvent[] = [];
  private next = 0;
  private waiting = false;
  private text = 'Machine player starting…';
  /** Think interval in ticks (from the same profile the worker plays with). */
  private readonly thinkTicks: number;

  constructor(
    private readonly game: Game,
    readonly player: PlayerId,
    profile: AIProfile,
    private readonly sink: Sink = (env) => game.enqueue(env),
    seed = 1,
  ) {
    const info = game.staticInfo(player);
    this.thinkTicks = aiTicks(profile, info.tickRate).think;
    this.worker = new Worker(new URL('../../ai/worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<FromAIMessage>) => this.receive(e.data);
    this.worker.onerror = (e) => {
      this.text = `Machine player crashed: ${e.message}`;
      console.error(e);
    };
    this.post({ type: 'init', info, profile, seed });
  }

  afterStep(events: readonly GameEvent[]): void {
    this.events.push(...forPlayer(this.player, events));
    if (this.waiting || this.game.tick < this.next) return;
    this.next = this.game.tick + this.thinkTicks;
    this.waiting = true;
    this.post({ type: 'observe', obs: this.game.observe(this.player, this.events) });
    this.events = [];
  }

  status(): string {
    return this.text;
  }

  dispose(): void {
    this.post({ type: 'dispose' });
    this.worker.terminate();
  }

  private receive(msg: FromAIMessage): void {
    if (msg.type === 'debug') {
      this.text = msg.text;
      return;
    }
    this.waiting = false;
    const tick = Math.max(msg.forTick, this.game.tick);
    msg.commands.forEach((cmd: Command) => this.sink({ player: this.player, tick, cmd }));
  }

  private post(msg: ToAIMessage): void {
    this.worker.postMessage(msg);
  }
}
