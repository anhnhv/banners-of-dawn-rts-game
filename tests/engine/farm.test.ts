/**
 * Gather buildings (docs/plans/m7b-farm-catapult.md §1): the Farm is a 4×4 building that one of
 * its owner's workers can gather food from, a little slower than at berries, and it never runs out.
 */
import { describe, expect, it } from 'vitest';
import { createGame, GAME_DATA, type Game } from '../../src/engine';
import { type Command, type EntityId, type PlayerId } from '../../src/shared';
import { node, openMap } from './helpers';

const FARM = GAME_DATA.buildings.farm!;
const RATES = GAME_DATA.units.worker!.interactions.gather!.targets;

function send(game: Game, player: PlayerId, cmd: Command): void {
  game.enqueue({ player, tick: game.tick, cmd });
  game.step();
}

function run(game: Game, seconds: number): void {
  for (let i = 0; i < seconds * 20; i++) game.step();
}

function setup(objects: Parameters<typeof openMap>[2] = []): { game: Game; hall: EntityId } {
  const game = createGame(openMap(40, 40, objects), { seed: 1 });
  const hall = game.debugBuilding(0, 'town_hall', 4, 4);
  game.debugBuilding(1, 'town_hall', 33, 33);
  return { game, hall };
}

const food = (game: Game, p: PlayerId = 0): number => game.player(p).resources.food;
const orderOf = (game: Game, id: EntityId) => game.units.get(id)?.orders[0];

describe('Farm (buildings.json → gather)', () => {
  it('is a 4×4 field for one worker, slower than berries per worker', () => {
    expect(FARM.footprint).toEqual([4, 4]);
    expect(FARM.gather).toMatchObject({ resource: 'food', slots: 1 });
    expect(RATES.farm).toBeLessThan(RATES.berry_bush!);
  });

  it('a worker gathers food from it at its rate, and it never runs out', () => {
    const { game } = setup();
    const farm = game.debugBuilding(0, 'farm', 12, 12);
    const w = game.debugSpawn(0, 'worker', 11.4, 13.5);
    send(game, 0, { type: 'interact', units: [w], target: farm });
    const before = food(game);
    run(game, 60);
    const gained = food(game) - before;
    expect(gained).toBeGreaterThanOrEqual(Math.floor(60 * RATES.farm! * 0.9));
    expect(gained).toBeLessThanOrEqual(Math.ceil(60 * RATES.farm!) + 1);
    run(game, 30 * 60);
    expect(food(game) - before).toBeGreaterThan(30 * 60 * RATES.farm! * 0.95); // still farming
    expect(game.getView(0).buildings.find((b) => b.id === farm)?.gatherers).toBe(1);
    expect(orderOf(game, w)?.kind).toBe('gather');
  });

  it('holds one farmer: a second worker goes to another free farm', () => {
    const { game } = setup();
    const a = game.debugBuilding(0, 'farm', 12, 12);
    const b = game.debugBuilding(0, 'farm', 18, 12);
    const w1 = game.debugSpawn(0, 'worker', 11.4, 13.5);
    const w2 = game.debugSpawn(0, 'worker', 11.4, 14.5);
    send(game, 0, { type: 'interact', units: [w1, w2], target: a });
    run(game, 20);
    const t1 = orderOf(game, w1);
    const t2 = orderOf(game, w2);
    expect(t1?.kind === 'gather' && t1.target).toBe(a);
    expect(t2?.kind === 'gather' && t2.target).toBe(b);
    const view = game.getView(0).buildings;
    expect(view.find((x) => x.id === a)?.gatherers).toBe(1);
    expect(view.find((x) => x.id === b)?.gatherers).toBe(1);
  });

  it('a worker sent to a taken farm with no free one nearby gathers other food, or stops', () => {
    const { game } = setup([node('berry_bush', 18, 13)]);
    const farm = game.debugBuilding(0, 'farm', 12, 12);
    const w1 = game.debugSpawn(0, 'worker', 11.4, 13.5);
    send(game, 0, { type: 'interact', units: [w1], target: farm });
    run(game, 5);
    const w2 = game.debugSpawn(0, 'worker', 11.4, 14.5);
    send(game, 0, { type: 'interact', units: [w2], target: farm });
    run(game, 15);
    const o = orderOf(game, w2);
    const bush = [...game.nodes.values()][0]!;
    expect(o?.kind === 'gather' && o.target).toBe(bush.id);
  });

  it('frees its slot when the farmer gets another order or dies', () => {
    const { game } = setup();
    const farm = game.debugBuilding(0, 'farm', 12, 12);
    const w1 = game.debugSpawn(0, 'worker', 11.4, 13.5);
    const w2 = game.debugSpawn(0, 'worker', 20.5, 20.5);
    send(game, 0, { type: 'interact', units: [w1], target: farm });
    run(game, 5);
    send(game, 0, { type: 'move', units: [w1], to: { x: 25, y: 25 } });
    send(game, 0, { type: 'interact', units: [w2], target: farm });
    run(game, 15);
    const o = orderOf(game, w2);
    expect(o?.kind === 'gather' && o.target).toBe(farm);
  });

  it('berries running out send the farmer on to a free farm by itself', () => {
    const { game } = setup([node('berry_bush', 12, 10, 5)]);
    const farm = game.debugBuilding(0, 'farm', 13, 12);
    const w = game.debugSpawn(0, 'worker', 11.5, 10.5);
    const bush = [...game.nodes.values()][0]!;
    send(game, 0, { type: 'interact', units: [w], target: bush.id });
    run(game, 40);
    expect(game.nodes.size).toBe(0);
    const o = orderOf(game, w);
    expect(o?.kind === 'gather' && o.target).toBe(farm);
  });

  it('a destroyed farm sends its farmer on; a site and an enemy farm cannot be farmed', () => {
    const { game } = setup([node('berry_bush', 17, 13)]);
    const farm = game.debugBuilding(0, 'farm', 12, 12);
    const enemyFarm = game.debugBuilding(1, 'farm', 12, 20);
    const w = game.debugSpawn(0, 'worker', 11.4, 13.5);
    const w2 = game.debugSpawn(0, 'worker', 11.4, 21.5);
    send(game, 0, { type: 'interact', units: [w], target: farm });
    send(game, 0, { type: 'interact', units: [w2], target: enemyFarm });
    run(game, 5);
    expect(orderOf(game, w2)?.kind).not.toBe('gather');

    const raiders = [0, 1, 2, 3, 4, 5].map((i) => game.debugSpawn(1, 'knight', 10 + i * 0.6, 17.5));
    send(game, 1, { type: 'interact', units: raiders, target: farm });
    for (let i = 0; i < 120 * 20 && game.buildings.has(farm); i++) game.step();
    expect(game.buildings.has(farm)).toBe(false);
    game.step();
    const o = orderOf(game, w);
    if (game.units.has(w)) expect(o?.kind === 'gather' && o.target).not.toBe(farm);

    // a site cannot be farmed
    const { game: g2 } = setup();
    send(g2, 0, { type: 'build', building: 'farm', at: { x: 12, y: 12 } });
    const site = g2.getView(0).buildings.find((b) => b.type === 'farm')!;
    expect(site.constructed).toBe(false);
    const w3 = g2.debugSpawn(0, 'worker', 11.4, 13.5);
    send(g2, 0, { type: 'interact', units: [w3], target: site.id });
    run(g2, 3);
    expect(orderOf(g2, w3)?.kind).not.toBe('gather');
  });

  it('a Town Hall rallied onto a farm sends new workers to farm it', () => {
    const { game, hall } = setup();
    const farm = game.debugBuilding(0, 'farm', 10, 4);
    send(game, 0, { type: 'setRally', building: hall, to: { x: 12, y: 6 }, target: farm });
    send(game, 0, { type: 'train', building: hall, unit: 'worker' });
    run(game, GAME_DATA.units.worker!.trainTime + 2);
    const worker = [...game.units.values()].find((u) => u.owner === 0 && u.type === 'worker')!;
    const o = worker.orders[0];
    expect(o?.kind === 'gather' && o.target).toBe(farm);
  });

  it('is deterministic', () => {
    const play = (): string => {
      const { game } = setup([node('berry_bush', 18, 13, 20)]);
      const farms = [game.debugBuilding(0, 'farm', 12, 12), game.debugBuilding(0, 'farm', 12, 18)];
      const ws = [0, 1, 2].map((i) => game.debugSpawn(0, 'worker', 10.5, 13 + i));
      send(game, 0, { type: 'interact', units: ws, target: farms[0]! });
      run(game, 120);
      return game.stateHash();
    };
    expect(play()).toBe(play());
  });

  it('the farmer steps onto the field to work, and walks back out for a new order', () => {
    const { game } = setup();
    const farm = game.debugBuilding(0, 'farm', 12, 12);
    const w = game.debugSpawn(0, 'worker', 9.5, 13.5);
    send(game, 0, { type: 'interact', units: [w], target: farm });
    run(game, 6);
    const u = game.units.get(w)!;
    const depth = FARM.gather!.workInside;
    expect(depth).toBeGreaterThan(0);
    expect(u.x).toBeGreaterThan(12 + depth - 0.01); // on the field
    expect(u.x).toBeLessThan(16);
    expect(game.getView(0).units.find((v) => v.id === w)?.activity).toBe('work');
    send(game, 0, { type: 'move', units: [w], to: { x: 25.5, y: 25.5 } });
    run(game, 12);
    expect(Math.hypot(u.x - 25.5, u.y - 25.5)).toBeLessThan(1);
  });

  it('the field still blocks everyone else, and raiders reach a farmer from its edge', () => {
    const { game } = setup();
    const farm = game.debugBuilding(0, 'farm', 12, 12);
    const w = game.debugSpawn(0, 'worker', 11.4, 13.5);
    send(game, 0, { type: 'interact', units: [w], target: farm });
    run(game, 6);
    // a unit walking across the field goes around it
    const walker = game.debugSpawn(0, 'militia', 10.5, 14.5);
    send(game, 0, { type: 'move', units: [walker], to: { x: 17.5, y: 14.5 } });
    for (let i = 0; i < 12 * 20; i++) {
      game.step();
      const m = game.units.get(walker)!;
      const inField = m.x > 12 && m.x < 16 && m.y > 12 && m.y < 16;
      expect(inField).toBe(false);
    }
    const raider = game.debugSpawn(1, 'scout_rider', 8.5, 20.5);
    send(game, 1, { type: 'interact', units: [raider], target: w });
    for (let i = 0; i < 40 * 20 && game.units.has(w); i++) game.step();
    expect(game.units.has(w)).toBe(false);
  });
});

describe('Farm slots', () => {
  it('a newcomer with a lower id never takes the slot of the farmer already at work', () => {
    const game = createGame(openMap(40, 40), { seed: 1 });
    game.debugBuilding(0, 'town_hall', 4, 4);
    const early = game.debugSpawn(0, 'worker', 30.5, 30.5); // lower id
    const farm = game.debugBuilding(0, 'farm', 12, 12);
    const farmer = game.debugSpawn(0, 'worker', 11.4, 13.5);
    // while the farm is still free, the lower-id worker queues: a long walk, then farm it
    game.enqueue({ player: 0, tick: 0, cmd: { type: 'move', units: [early], to: { x: 22.5, y: 14.5 } } });
    game.enqueue({
      player: 0,
      tick: 0,
      cmd: { type: 'interact', units: [early], target: farm, queue: true },
    });
    game.step();
    // meanwhile the other worker starts farming it
    game.enqueue({ player: 0, tick: game.tick, cmd: { type: 'interact', units: [farmer], target: farm } });
    for (let i = 0; i < 15 * 20; i++) game.step();
    const o = game.units.get(farmer)!.orders[0];
    expect(o?.kind === 'gather' && o.target).toBe(farm);
    expect(game.getView(0).buildings.find((b) => b.id === farm)?.gatherers).toBe(1);
    const e = game.units.get(early)!.orders[0];
    expect(e?.kind === 'gather' && e.target).not.toBe(farm);
  });
});
