/**
 * The AI module is an engine without configuration: it plays with whatever valid profile it is
 * given (not only the app's shipped modes), and holds no settings of its own.
 */
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createAIPlayer, parseAIProfile } from '..';
import { PROFILES } from '../../src/ai';
import { InlineAIController } from '../../src/host/aiController';
import { createGame } from '../../src/engine';
import { decodeMap, TICK_RATE, type CommandEnvelope } from '../../src/shared';
import { GREEN_VALLEY } from '../../tests/engine/helpers';

const custom = parseAIProfile(
  { ...structuredClone(PROFILES.normal), name: 'Custom', persona: 'a test' },
  'custom',
);
custom.tempo.thinkSeconds = 3;

describe('AI engine', () => {
  it('plays with a profile that is not a shipped mode', () => {
    const game = createGame(decodeMap(GREEN_VALLEY), { seed: 3 });
    const ai = createAIPlayer();
    ai.init(game.staticInfo(1), custom, 3);
    expect(ai.thinkTicks).toBe(3 * TICK_RATE);

    const sent: CommandEnvelope[] = [];
    const ctl = new InlineAIController(game, 1, custom, (env) => {
      sent.push(env);
      game.enqueue(env);
    });
    for (let i = 0; i < 60 * TICK_RATE; i++) ctl.afterStep(game.step());
    expect(sent.length).toBeGreaterThan(0);
    expect(ctl.status()).toContain('Custom');
  });

  it('holds no configuration files', () => {
    const files = readdirSync(new URL('..', import.meta.url), { recursive: true }) as string[];
    expect(files.filter((f) => f.endsWith('.json') && f !== 'tsconfig.json')).toEqual([]);
  });
});
