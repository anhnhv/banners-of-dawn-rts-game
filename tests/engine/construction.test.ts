import { describe, expect, it } from 'vitest';
import { createGame, GAME_DATA, type Game } from '../../src/engine';
import type { Command, GameEvent, PlayerId } from '../../src/shared';
import { asciiMap, openMap } from './helpers';

function send(game: Game, player: PlayerId, cmd: Command): GameEvent[] {
  game.enqueue({ player, tick: game.tick, cmd });
  return game.step();
}

function run(game: Game, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * 20; i++) events.push(...game.step());
  return events;
}

const START = GAME_DATA.game.startingResources;
const HOUSE = GAME_DATA.buildings.house!;

function setup(): { game: Game; hall: number } {
  const game = createGame(openMap(32, 32), { seed: 1 });
  const hall = game.debugBuilding(0, 'town_hall', 4, 4);
  return { game, hall };
}

describe('construction (no workers; game.json → buildMenu)', () => {
  it('placing a house pays the cost and creates a site that finishes by itself on time', () => {
    const { game } = setup();
    send(game, 0, { type: 'build', building: 'house', at: { x: 12, y: 12 } });
    expect(game.player(0).resources.wood).toBe(START.wood - (HOUSE.cost.wood ?? 0));
    const site = game.getView(0).buildings.find((b) => b.type === 'house')!;
    expect(site.constructed).toBe(false);
    const startHp = HOUSE.hp * GAME_DATA.game.construction.startHpFraction;
    expect(site.hp).toBeGreaterThanOrEqual(startHp); // one tick of progress already happened
    expect(site.hp).toBeLessThan(startHp + HOUSE.hp * 0.01);
    expect(game.getView(0).self.popCap).toBe(5); // a site gives no population

    run(game, HOUSE.buildTime / 2);
    const half = game.getView(0).buildings.find((b) => b.id === site.id)!;
    expect(half.buildProgress).toBeGreaterThan(0.45);
    expect(half.buildProgress).toBeLessThan(0.55);
    expect(half.hp).toBeGreaterThan(site.hp);

    const events = run(game, HOUSE.buildTime / 2 + 0.2);
    expect(events.some((e) => e.type === 'buildingCompleted' && e.building === site.id)).toBe(true);
    const done = game.getView(0).buildings.find((b) => b.id === site.id)!;
    expect(done.constructed).toBe(true);
    expect(done.hp).toBe(HOUSE.hp);
    expect(game.getView(0).self.popCap).toBe(5 + HOUSE.popProvided);
  });

  it('rejects bad placements, unknown buildings and unaffordable buildings', () => {
    const rows = Array.from({ length: 20 }, (_, y) =>
      y === 10 ? '....WWWW............' : '....................',
    );
    const game = createGame(asciiMap(rows), { seed: 1 });
    expect(send(game, 0, { type: 'build', building: 'house', at: { x: 5, y: 9 } })[0]).toMatchObject({
      reason: 'BAD_PLACEMENT',
    });
    expect(send(game, 0, { type: 'build', building: 'castle', at: { x: 1, y: 1 } })[0]).toMatchObject({
      reason: 'NOT_AVAILABLE',
    });
    send(game, 0, { type: 'build', building: 'house', at: { x: 1, y: 1 } });
    expect(send(game, 0, { type: 'build', building: 'house', at: { x: 2, y: 2 } })[0]).toMatchObject({
      reason: 'BAD_PLACEMENT', // overlaps the first site
    });
    game.debugGive(0, { wood: -game.player(0).resources.wood });
    expect(send(game, 0, { type: 'build', building: 'house', at: { x: 12, y: 1 } })[0]).toMatchObject({
      reason: 'NOT_ENOUGH_WOOD',
    });
  });

  it('cancelling a site refunds the full cost and frees the tiles', () => {
    const { game } = setup();
    send(game, 0, { type: 'build', building: 'barracks', at: { x: 14, y: 14 } });
    const site = game.getView(0).buildings.find((b) => b.type === 'barracks')!;
    send(game, 0, { type: 'cancelBuild', building: site.id });
    expect(game.player(0).resources.wood).toBe(START.wood);
    expect(game.getView(0).buildings.some((b) => b.id === site.id)).toBe(false);
    send(game, 0, { type: 'build', building: 'barracks', at: { x: 14, y: 14 } });
    expect(game.getView(0).buildings.some((b) => b.type === 'barracks')).toBe(true);
  });

  it('a site cannot train until it is finished; afterwards it uses its config actions', () => {
    const { game } = setup();
    send(game, 0, { type: 'build', building: 'barracks', at: { x: 14, y: 14 } });
    const id = game.getView(0).buildings.find((b) => b.type === 'barracks')!.id;
    expect(send(game, 0, { type: 'train', building: id, unit: 'militia' })[0]).toMatchObject({
      reason: 'NOT_AVAILABLE',
    });
    run(game, GAME_DATA.buildings.barracks!.buildTime + 1);
    expect(send(game, 0, { type: 'train', building: id, unit: 'militia' })).toEqual([]);
  });

  it('moves units off a new footprint', () => {
    const { game } = setup();
    const u = game.debugSpawn(0, 'militia', 13.5, 13.5);
    send(game, 0, { type: 'build', building: 'house', at: { x: 13, y: 13 } });
    const unit = game.units.get(u)!;
    const inside = unit.x >= 13 && unit.x < 15 && unit.y >= 13 && unit.y < 15;
    expect(inside).toBe(false);
  });
});
