/** Headless match helpers for AI tests: real engine + inline machine players. */
import { readFileSync } from 'node:fs';
import { createGame, type Game } from '../../src/engine';
import { InlineAIController } from '../../src/host/aiController';
import type { AIMode } from '../../src/ai';
import { decodeMap, TICK_RATE, type MapFile, type PlayerId } from '../../src/shared';

export const GREEN_VALLEY = JSON.parse(
  readFileSync(new URL('../../maps/green_valley.json', import.meta.url), 'utf8'),
) as MapFile;

export interface Match {
  game: Game;
  ais: InlineAIController[];
  /** Units trained so far, per player and type (from unitTrained events). */
  trained: Map<PlayerId, Record<string, number>>;
  /** Run until `seconds` of game time pass or the match ends. */
  run(seconds: number): void;
}

export function match(opts: {
  scenario: boolean;
  ai: PlayerId[];
  /** Mode for every AI player, or per player. Default easy. */
  mode?: AIMode | Partial<Record<PlayerId, AIMode>>;
  seed?: number;
  testArmy?: number;
}): Match {
  const game = createGame(decodeMap(GREEN_VALLEY), {
    seed: opts.seed ?? 5,
    scenario: opts.scenario,
    testArmy: opts.testArmy,
  });
  const modeOf = (p: PlayerId): AIMode =>
    (typeof opts.mode === 'string' ? opts.mode : opts.mode?.[p]) ?? 'easy';
  const ais = opts.ai.map((p) => new InlineAIController(game, p, modeOf(p), undefined, opts.seed ?? 5));
  const trained = new Map<PlayerId, Record<string, number>>();
  return {
    game,
    ais,
    trained,
    run(seconds: number) {
      const end = game.tick + seconds * TICK_RATE;
      while (game.tick < end && !game.result) {
        const events = game.step();
        for (const e of events)
          if (e.type === 'unitTrained') {
            const t = trained.get(e.player) ?? {};
            t[e.unitType] = (t[e.unitType] ?? 0) + 1;
            trained.set(e.player, t);
          }
        for (const ai of ais) ai.afterStep(events);
      }
    },
  };
}
