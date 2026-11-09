/** The match pace (GameOptions.rules) drives gathering, training, building, pop cap and stockpile. */
import { describe, expect, it } from 'vitest';
import paceJson from '../../src/data/pace.json';
import { createGame, GAME_DATA, type Game } from '../../src/engine';
import { decodeMap, parsePaceFile, rulesForPace, type MatchRules } from '../../src/shared';
import { GREEN_VALLEY } from '../ai/sim';
import { node, openMap } from './helpers';

const PACE = parsePaceFile(paceJson);
const STANDARD = rulesForPace(PACE, 'standard');
const FAST = rulesForPace(PACE, 'fast');

function run(game: Game, seconds: number): void {
  for (let i = 0; i < seconds * 20; i++) game.step();
}

function woodAfter(rules: MatchRules, seconds: number): number {
  const game = createGame(openMap(32, 32, [node('tree', 12, 5)]), { seed: 1, rules });
  game.debugBuilding(0, 'town_hall', 4, 4);
  const tree = [...game.nodes.values()][0]!;
  const worker = game.debugSpawn(0, 'worker', 11.3, 5.5);
  game.enqueue({ player: 0, tick: game.tick, cmd: { type: 'interact', units: [worker], target: tree.id } });
  run(game, seconds);
  return game.player(0).resources.wood - rules.startingResources.wood;
}

describe('match pace', () => {
  it('no rules = game.json (Standard)', () => {
    const game = createGame(openMap(16, 16), { seed: 1 });
    expect(game.rules.pace).toBe('standard');
    expect(game.player(0).resources).toEqual(GAME_DATA.game.startingResources);
  });

  it('starting resources come from the preset', () => {
    const game = createGame(openMap(16, 16), { seed: 1, rules: FAST });
    expect(game.player(0).resources).toEqual({ food: 500, wood: 500, gold: 300 });
    expect(game.player(1).resources).toEqual({ food: 500, wood: 500, gold: 300 });
  });

  it('Fast gathers 1.5 times as fast', () => {
    const slow = woodAfter(STANDARD, 20);
    const fast = woodAfter(FAST, 20);
    expect(fast / slow).toBeGreaterThan(1.35);
    expect(fast / slow).toBeLessThan(1.65);
  });

  it('Fast trains and builds 1.5 times as fast', () => {
    for (const [rules, factor] of [
      [STANDARD, 1],
      [FAST, 1.5],
    ] as const) {
      const game = createGame(openMap(32, 32), { seed: 1, rules });
      const hall = game.debugBuilding(0, 'town_hall', 4, 4);
      game.enqueue({ player: 0, tick: 0, cmd: { type: 'train', building: hall, unit: 'worker' } });
      game.enqueue({ player: 0, tick: 0, cmd: { type: 'build', building: 'house', at: { x: 14, y: 4 } } });
      game.step();
      const b = game.buildings.get(hall)!;
      const train = GAME_DATA.units.worker!.trainTime * 20;
      expect(b.queue[0]!.total).toBe(Math.round(train / factor));
      const site = [...game.buildings.values()].find((x) => x.type === 'house')!;
      expect(site.buildTotal).toBe(Math.round((GAME_DATA.buildings.house!.buildTime * 20) / factor));
    }
  });

  it('the pop cap comes from the preset', () => {
    const blitz = rulesForPace(PACE, 'blitz');
    const game = createGame(openMap(40, 40), { seed: 1, rules: blitz });
    for (let i = 0; i < 30; i++) game.debugBuilding(0, 'house', (i % 10) * 3, Math.floor(i / 10) * 3 + 20);
    game.step();
    expect(game.getView(0).self.popCap).toBe(125);
  });

  it('the machine player gets game data with the match rules filled in', () => {
    const game = createGame(decodeMap(GREEN_VALLEY), { seed: 1, rules: FAST });
    const info = game.staticInfo(1);
    expect(info.data.game.pace.trainSpeed).toBe(1.5);
    expect(info.data.game.startingResources).toEqual({ food: 500, wood: 500, gold: 300 });
  });

  it('the scenario stockpile still wins for the players it lists', () => {
    const game = createGame(decodeMap(GREEN_VALLEY), { seed: 1, rules: FAST, scenario: true });
    expect(game.player(0).resources).toEqual({ food: 600, wood: 600, gold: 400 });
    expect(game.player(1).resources).toEqual({ food: 500, wood: 500, gold: 300 });
  });
});
