/** Victory (game.json → victory), match result and the machine player's observation. */
import { describe, expect, it } from 'vitest';
import { createGame, GAME_DATA, type Game } from '../../src/engine';
import { decodeMap, type GameEvent } from '../../src/shared';
import { GREEN_VALLEY } from '../ai/sim';
import { openMap } from './helpers';

function townHall(game: Game, owner: 0 | 1): { hp: number; id: number } {
  const b = [...game.buildings.values()].find((x) => x.owner === owner && x.type === 'town_hall');
  if (!b) throw new Error('no Town Hall');
  return b as unknown as { hp: number; id: number };
}

function run(game: Game, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * 20; i++) events.push(...game.step());
  return events;
}

describe('victory', () => {
  it('the rule comes from game.json (Town Hall by default)', () => {
    expect(GAME_DATA.game.victory.defeatWhenLost).toEqual(['town_hall']);
  });

  it('losing the Town Hall loses the game; the simulation then freezes', () => {
    const game = createGame(decodeMap(GREEN_VALLEY), { seed: 1 });
    run(game, 1);
    expect(game.result).toBeNull();
    townHall(game, 1).hp = 0;
    const events = run(game, 1);
    expect(events).toContainEqual({ type: 'gameOver', winner: 0 });
    expect(game.result?.winner).toBe(0);
    expect(game.result?.stats[1]?.buildingsLost).toBe(1);
    expect(game.getView(0).result?.winner).toBe(0);
    const tick = game.tick;
    run(game, 2);
    expect(game.tick).toBe(tick);
  });

  it('both Town Halls falling in the same tick is a draw', () => {
    const game = createGame(decodeMap(GREEN_VALLEY), { seed: 1 });
    run(game, 1);
    townHall(game, 0).hp = 0;
    townHall(game, 1).hp = 0;
    run(game, 1);
    expect(game.result?.winner).toBeNull();
  });

  it('a player who never had a Town Hall (test arena) never loses', () => {
    const game = createGame(openMap(20, 20), { seed: 1 });
    run(game, 2);
    expect(game.result).toBeNull();
  });

  it('counts trained units and finished buildings in the stats', () => {
    const game = createGame(decodeMap(GREEN_VALLEY), { seed: 1 });
    const th = townHall(game, 0);
    game.enqueue({ player: 0, tick: 0, cmd: { type: 'train', building: th.id, unit: 'worker' } });
    run(game, 20);
    townHall(game, 1).hp = 0;
    run(game, 1);
    expect(game.result?.stats[0]?.unitsTrained).toBe(1);
    expect(game.result?.reason).toBe('destroyed');
  });

  it('surrender ends the match at once; the other player wins', () => {
    const game = createGame(decodeMap(GREEN_VALLEY), { seed: 1 });
    run(game, 1);
    game.enqueue({ player: 0, tick: game.tick, cmd: { type: 'surrender' } });
    const events = run(game, 1);
    expect(events).toContainEqual({ type: 'gameOver', winner: 1 });
    expect(game.result).toMatchObject({ winner: 1, reason: 'surrender' });
    expect(townHall(game, 0).hp).toBeGreaterThan(0); // nothing had to be destroyed
  });

  it('a surrender after the match is over changes nothing', () => {
    const game = createGame(decodeMap(GREEN_VALLEY), { seed: 1 });
    run(game, 1);
    townHall(game, 1).hp = 0;
    run(game, 1);
    game.enqueue({ player: 0, tick: game.tick, cmd: { type: 'surrender' } });
    run(game, 1);
    expect(game.result).toMatchObject({ winner: 0, reason: 'destroyed' });
  });
});

describe('observe() for the machine player', () => {
  it('lists every unit, building and node with orders summarized, as plain data', () => {
    const game = createGame(decodeMap(GREEN_VALLEY), { seed: 1, scenario: true });
    run(game, 2);
    const obs = game.observe(1);
    expect(obs.player).toBe(1);
    expect(obs.units.length).toBe(game.units.size);
    expect(obs.buildings.length).toBe(game.buildings.size);
    expect(obs.nodes.length).toBe(game.nodes.size);
    expect(obs.units.some((u) => u.owner === 1 && u.order.kind === 'gather')).toBe(true);
    expect(obs.over).toBe(false);
    expect(structuredClone(obs)).toEqual(obs);
    const info = game.staticInfo(1);
    expect(info.buildable.length).toBe(info.width * info.height);
    expect(info.spawns).toHaveLength(2);
    expect(structuredClone(info).data.units.worker?.cost).toEqual(GAME_DATA.units.worker?.cost);
  });
});
