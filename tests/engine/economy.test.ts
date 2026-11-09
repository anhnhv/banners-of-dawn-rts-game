import { describe, expect, it } from 'vitest';
import { createGame, GAME_DATA, type Game } from '../../src/engine';
import { type Command, type GameEvent, type PlayerId } from '../../src/shared';
import { node, openMap } from './helpers';

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

/** Town Hall at (4,4) (3×3), resources placed as given. */
function setup(objects: Parameters<typeof openMap>[2] = []): { game: Game; hall: number } {
  const game = createGame(openMap(32, 32, objects), { seed: 1 });
  const hall = game.debugBuilding(0, 'town_hall', 4, 4);
  return { game, hall };
}

describe('gathering (configured in units.json → interactions.gather)', () => {
  it('skips a tree whose only free neighbour is a pocket enclosed by other trees', () => {
    // a 5×5 block of trees with a free tile in the middle: the tree just above the pocket can
    // only be reached from inside it, so the worker takes a reachable tree of the block instead
    const trees: Parameters<typeof openMap>[2] = [];
    for (let y = 8; y <= 12; y++)
      for (let x = 18; x <= 22; x++) if (x !== 20 || y !== 10) trees.push(node('tree', x, y));
    const { game } = setup(trees);
    const pocketTree = [...game.nodes.values()].find((n) => n.x === 20 && n.y === 9)!;
    const worker = game.debugSpawn(0, 'worker', 12.5, 10.5);
    send(game, 0, { type: 'interact', units: [worker], target: pocketTree.id });
    run(game, 15);
    const order = game.units.get(worker)!.orders[0];
    expect(order?.kind).toBe('gather');
    expect(order?.kind === 'gather' && order.target).not.toBe(pocketTree.id);
    expect(game.player(0).resources.wood).toBeGreaterThan(START.wood);
  });

  it('a worker harvests a tree straight into the stockpile (no carrying, no drop-off)', () => {
    const { game } = setup([node('tree', 12, 5)]);
    const tree = [...game.nodes.values()][0]!;
    const worker = game.debugSpawn(0, 'worker', 11.3, 5.5);
    send(game, 0, { type: 'interact', units: [worker], target: tree.id });
    const rate = GAME_DATA.units.worker!.interactions.gather!.targets.tree!;
    run(game, 10);
    const gained = game.player(0).resources.wood - START.wood;
    expect(gained).toBeGreaterThanOrEqual(Math.floor(rate * 10) - 1);
    expect(gained).toBeLessThanOrEqual(Math.ceil(rate * 10));
    expect(game.nodes.get(tree.id)!.amount).toBe(100 - gained);
    expect(game.units.get(worker)!.orders[0]?.kind).toBe('gather'); // keeps going
  });

  it('shows the work activity while harvesting', () => {
    const { game } = setup([node('berry_bush', 9, 5)]);
    const bush = [...game.nodes.values()][0]!;
    const worker = game.debugSpawn(0, 'worker', 8.3, 5.5);
    send(game, 0, { type: 'interact', units: [worker], target: bush.id });
    run(game, 1);
    const v = game.getView(0).units.find((u) => u.id === worker)!;
    expect(v.activity).toBe('work');
    expect(v.task).toBe('Gathering food');
  });

  it('retargets the nearest node of the same resource when one runs out, and unblocks its tile', () => {
    const { game } = setup([node('tree', 10, 5, 5), node('pine', 11, 7)]);
    const [small, next] = [...game.nodes.values()];
    const worker = game.debugSpawn(0, 'worker', 9.5, 4.5);
    send(game, 0, { type: 'interact', units: [worker], target: small!.id });
    const events = run(game, 40);
    expect(events.some((e) => e.type === 'resourceDepleted' && e.node === small!.id)).toBe(true);
    expect(game.nodes.has(small!.id)).toBe(false);
    expect(game.getView(0).resources.has(small!.id)).toBe(false);
    const order = game.units.get(worker)!.orders[0];
    expect(order?.kind === 'gather' && order.target).toBe(next!.id);
    expect(game.nodes.get(next!.id)!.amount).toBeLessThan(100);
  });

  it('units without a gather interaction just walk to the resource', () => {
    const { game } = setup([node('tree', 20, 20)]);
    const tree = [...game.nodes.values()][0]!;
    const militia = game.debugSpawn(0, 'militia', 10.5, 10.5);
    send(game, 0, { type: 'interact', units: [militia], target: tree.id });
    expect(game.units.get(militia)!.orders[0]?.kind).toBe('move');
    run(game, 10);
    const u = game.units.get(militia)!;
    expect(Math.hypot(u.x - 20.5, u.y - 20.5)).toBeLessThan(2);
    expect(game.nodes.get(tree.id)!.amount).toBe(100);
  });
});

describe('training (configured in buildings.json → actions)', () => {
  it('the Town Hall trains a worker: pays the cost, takes the train time, spawns it', () => {
    const { game, hall } = setup();
    const cost = GAME_DATA.units.worker!.cost.food!;
    send(game, 0, { type: 'train', building: hall, unit: 'worker' });
    expect(game.player(0).resources.food).toBe(START.food - cost);
    expect(game.getView(0).buildings[0]!.queue).toHaveLength(1);
    const before = game.units.size;
    run(game, GAME_DATA.units.worker!.trainTime - 1);
    expect(game.units.size).toBe(before);
    const events = run(game, 1.5);
    expect(game.units.size).toBe(before + 1);
    expect(events.some((e) => e.type === 'unitTrained')).toBe(true);
  });

  it('rejects units the building cannot train, unaffordable units and full queues', () => {
    const { game, hall } = setup();
    expect(send(game, 0, { type: 'train', building: hall, unit: 'knight' })).toEqual([
      { type: 'commandRejected', player: 0, reason: 'NOT_AVAILABLE' },
    ]);
    game.debugGive(0, { food: 1000 });
    for (let i = 0; i < GAME_DATA.game.production.queueMax; i++)
      send(game, 0, { type: 'train', building: hall, unit: 'worker' });
    expect(send(game, 0, { type: 'train', building: hall, unit: 'worker' })[0]).toMatchObject({
      reason: 'QUEUE_FULL',
    });
    const poor = setup();
    poor.game.debugGive(0, { food: -START.food });
    expect(send(poor.game, 0, { type: 'train', building: poor.hall, unit: 'worker' })[0]).toMatchObject({
      reason: 'NOT_ENOUGH_FOOD',
    });
  });

  it('cancelling refunds the full cost', () => {
    const { game, hall } = setup();
    send(game, 0, { type: 'train', building: hall, unit: 'worker' });
    send(game, 0, { type: 'cancelTrain', building: hall, index: 0 });
    expect(game.player(0).resources.food).toBe(START.food);
    expect(game.getView(0).buildings[0]!.queue).toHaveLength(0);
  });

  it('waits when the population cap is reached', () => {
    const { game, hall } = setup();
    const cap = GAME_DATA.buildings.town_hall!.popProvided;
    for (let i = 0; i < cap; i++) game.debugSpawn(0, 'worker', 12.5 + i, 12.5);
    send(game, 0, { type: 'train', building: hall, unit: 'worker' });
    const events = run(game, 15);
    expect(events.some((e) => e.type === 'popCapped')).toBe(true);
    expect(game.getView(0).buildings[0]!.popBlocked).toBe(true);
    expect(game.getView(0).self).toMatchObject({ pop: cap, popCap: cap });
  });

  it('a worker trained with the rally point on a resource starts gathering it', () => {
    const { game, hall } = setup([node('tree', 12, 9)]);
    const tree = [...game.nodes.values()][0]!;
    send(game, 0, { type: 'setRally', building: hall, to: { x: 12.5, y: 9.5 }, target: tree.id });
    send(game, 0, { type: 'train', building: hall, unit: 'worker' });
    run(game, GAME_DATA.units.worker!.trainTime + 1);
    const worker = [...game.units.values()].find((u) => u.type === 'worker')!;
    expect(worker.orders[0]?.kind).toBe('gather');
  });
});
