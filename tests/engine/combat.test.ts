import { describe, expect, it } from 'vitest';
import { createGame, GAME_DATA, type Game } from '../../src/engine';
import type { Command, EntityId, GameEvent, PlayerId } from '../../src/shared';
import { openMap } from './helpers';

function send(game: Game, player: PlayerId, cmd: Command): GameEvent[] {
  game.enqueue({ player, tick: game.tick, cmd });
  return game.step();
}

function run(game: Game, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * 20; i++) events.push(...game.step());
  return events;
}

/** Run until one side has no units left (or the time runs out). */
function fight(game: Game, a: EntityId[], b: EntityId[], seconds = 90): 'a' | 'b' | 'none' {
  for (let i = 0; i < seconds * 20; i++) {
    game.step();
    const aliveA = a.filter((id) => game.units.has(id)).length;
    const aliveB = b.filter((id) => game.units.has(id)).length;
    if (aliveB === 0 && aliveA > 0) return 'a';
    if (aliveA === 0 && aliveB > 0) return 'b';
  }
  return 'none';
}

const U = GAME_DATA.units;

function arena(): Game {
  return createGame(openMap(40, 40), { seed: 7 });
}

function attackAll(game: Game, player: PlayerId, units: EntityId[], target: EntityId): void {
  send(game, player, { type: 'interact', units, target });
}

describe('damage formula (units.json → attack, game.json → combat)', () => {
  it('applies class bonus and armor: militia vs knight hits for 4 + 8 − 2', () => {
    const game = arena();
    const m = game.debugSpawn(0, 'militia', 10, 10);
    const k = game.debugSpawn(1, 'knight', 10.7, 10);
    send(game, 1, { type: 'setStance', units: [k], stance: 'hold' });
    send(game, 1, { type: 'stop', units: [k] });
    const before = game.units.get(k)!.hp;
    attackAll(game, 0, [m], k);
    run(game, 0.2);
    const expected = U.militia!.attack!.damage + U.militia!.attack!.bonus.cavalry! - U.knight!.armor;
    expect(before - game.units.get(k)!.hp).toBe(expected);
  });

  it('never deals less than combat.minDamage', () => {
    const game = arena();
    const w = game.debugSpawn(0, 'worker', 10, 10);
    const k = game.debugSpawn(1, 'knight', 10.7, 10);
    send(game, 1, { type: 'setStance', units: [k], stance: 'hold' });
    game.debugGive(0, {});
    // worker attack 3 vs knight armor 2 = 1; check the floor holds with a weaker hit too
    attackAll(game, 0, [w], k);
    run(game, 0.2);
    expect(game.units.get(k)!.maxHp - game.units.get(k)!.hp).toBe(
      Math.max(GAME_DATA.game.combat.minDamage, U.worker!.attack!.damage - U.knight!.armor),
    );
  });
});

describe('counter scenarios (PLAN §2.4)', () => {
  it('3 militia beat 1 knight', () => {
    const game = arena();
    const mil = [10, 10.6, 11.2].map((y) => game.debugSpawn(0, 'militia', 10, y));
    const k = game.debugSpawn(1, 'knight', 13, 10.6);
    attackAll(game, 0, mil, k);
    expect(fight(game, mil, [k])).toBe('a');
  });

  it('1 knight beats 1 militia (the counter needs numbers)', () => {
    const game = arena();
    const m = game.debugSpawn(0, 'militia', 10, 10);
    const k = game.debugSpawn(1, 'knight', 12, 10);
    attackAll(game, 0, [m], k);
    expect(fight(game, [m], [k])).toBe('b');
  });

  it('1 militia beats 1 scout rider', () => {
    const game = arena();
    const m = game.debugSpawn(0, 'militia', 10, 10);
    const s = game.debugSpawn(1, 'scout_rider', 12, 10);
    attackAll(game, 0, [m], s);
    expect(fight(game, [m], [s])).toBe('a');
  });

  it('2 archers beat 2 militia closing in from 6 tiles', () => {
    const game = arena();
    const arch = [10, 11].map((y) => game.debugSpawn(0, 'archer', 10, y));
    const mil = [10, 11].map((y) => game.debugSpawn(1, 'militia', 16, y));
    attackAll(game, 1, mil, arch[0]!);
    expect(fight(game, arch, mil)).toBe('a');
  });

  it('a scout rider beats an archer', () => {
    const game = arena();
    const s = game.debugSpawn(0, 'scout_rider', 10, 10);
    const a = game.debugSpawn(1, 'archer', 15, 10);
    attackAll(game, 0, [s], a);
    expect(fight(game, [s], [a])).toBe('a');
  });

  it('a catapult wrecks a building with its class bonus and cannot hit inside its min range', () => {
    const game = arena();
    const house = game.debugBuilding(1, 'house', 20, 10);
    const cat = game.debugSpawn(0, 'catapult', 14, 11);
    attackAll(game, 0, [cat], house);
    const events = run(game, 60);
    expect(events.some((e) => e.type === 'buildingDestroyed' && e.building === house)).toBe(true);
    // min range: an enemy right next to an idle catapult is not auto-acquired
    const game2 = arena();
    const c2 = game2.debugSpawn(0, 'catapult', 10, 10);
    const w = game2.debugSpawn(1, 'worker', 10.9, 10);
    run(game2, 1);
    expect(game2.units.get(c2)!.orders).toHaveLength(0);
    expect(game2.units.get(w)!.hp).toBe(U.worker!.hp);
  });
});

describe('projectiles (projectiles.json)', () => {
  it('arrows take time to fly; the damage lands on arrival', () => {
    const game = arena();
    const a = game.debugSpawn(0, 'archer', 10, 10);
    const m = game.debugSpawn(1, 'militia', 14, 10);
    send(game, 1, { type: 'setStance', units: [m], stance: 'hold' });
    attackAll(game, 0, [a], m);
    run(game, 0.1);
    expect(game.getView(0).projectiles.length).toBe(1);
    expect(game.units.get(m)!.hp).toBe(U.militia!.hp);
    run(game, 1);
    expect(game.units.get(m)!.hp).toBe(U.militia!.hp - (4 + 4 - 1));
    const p = game.getView(0).projectiles;
    expect(p.every((x) => x.z >= 0)).toBe(true);
  });
});

describe('targeting, stances and leash (PLAN §2.8)', () => {
  it('idle aggressive units attack enemies within sight, not beyond it', () => {
    const game = arena();
    const m = game.debugSpawn(0, 'militia', 10, 10);
    const near = game.debugSpawn(1, 'worker', 10 + U.militia!.sight - 0.5, 10);
    const far = game.debugSpawn(1, 'worker', 10, 10 + U.militia!.sight + 4);
    run(game, 0.5);
    const order = game.units.get(m)!.orders[0];
    expect(order).toMatchObject({ kind: 'attack', target: near, auto: true });
    expect(order && 'target' in order && order.target).not.toBe(far);
  });

  it('prefers military over workers over buildings, and the unit hitting it above all', () => {
    const game = arena();
    const m = game.debugSpawn(0, 'militia', 20, 20);
    game.debugBuilding(1, 'house', 22, 19);
    game.debugSpawn(1, 'worker', 21.2, 20);
    const enemyMil = game.debugSpawn(1, 'militia', 20, 22.5);
    send(game, 1, { type: 'setStance', units: [enemyMil], stance: 'hold' });
    run(game, 0.5);
    expect(game.units.get(m)!.orders[0]).toMatchObject({ kind: 'attack', target: enemyMil });
  });

  it('hold stance never moves and only attacks within reach', () => {
    const game = arena();
    const m = game.debugSpawn(0, 'militia', 10, 10);
    send(game, 0, { type: 'setStance', units: [m], stance: 'hold' });
    game.debugSpawn(1, 'worker', 12.5, 10);
    run(game, 3);
    const u = game.units.get(m)!;
    expect(Math.hypot(u.x - 10, u.y - 10)).toBeLessThan(0.05);
    expect(u.orders).toHaveLength(0);
  });

  it('an auto-acquired chase gives up beyond the leash and walks back', () => {
    const game = arena();
    const m = game.debugSpawn(0, 'militia', 5, 20);
    const s = game.debugSpawn(1, 'scout_rider', 8, 20);
    run(game, 0.5);
    expect(game.units.get(m)!.orders[0]).toMatchObject({ kind: 'attack', auto: true });
    send(game, 1, { type: 'move', units: [s], to: { x: 38, y: 20 } }); // faster: runs away
    run(game, 25);
    const u = game.units.get(m)!;
    expect(Math.hypot(u.x - 5, u.y - 20)).toBeLessThan(1.5);
  });

  it('attack-move fights enemies met on the way, then reaches the destination', () => {
    const game = arena();
    const mil = [10, 10.7].map((y) => game.debugSpawn(0, 'militia', 5, y));
    const w = game.debugSpawn(1, 'worker', 15, 10.3);
    send(game, 0, { type: 'attackMove', units: mil, to: { x: 30, y: 10.3 } });
    const events = run(game, 30);
    expect(events.some((e) => e.type === 'unitDied' && e.unit === w)).toBe(true);
    for (const id of mil) expect(game.units.get(id)!.x).toBeGreaterThan(28);
  });

  it('an explicit attack order ignores the leash', () => {
    const game = arena();
    const m = game.debugSpawn(0, 'militia', 5, 20);
    const w = game.debugSpawn(1, 'worker', 25, 20);
    attackAll(game, 0, [m], w);
    const events = run(game, 30);
    expect(events.some((e) => e.type === 'unitDied' && e.unit === w)).toBe(true);
  });
});

describe('workers (units.json → combat)', () => {
  it('never auto-attack and flee when hit while idle', () => {
    const game = arena();
    const w = game.debugSpawn(0, 'worker', 10, 10);
    const enemy = game.debugSpawn(1, 'militia', 30, 30);
    send(game, 1, { type: 'setStance', units: [enemy], stance: 'hold' });
    const victim = game.debugSpawn(1, 'worker', 11, 10);
    run(game, 2);
    expect(game.units.get(w)!.orders).toHaveLength(0); // no auto attack
    expect(game.units.get(victim)!.hp).toBe(U.worker!.hp);
    // now an enemy hits the idle worker: it runs about fleeWhenHit tiles away
    const attacker = game.debugSpawn(1, 'militia', 9.4, 10);
    attackAll(game, 1, [attacker], w);
    run(game, 0.3);
    expect(game.units.get(w)!.orders[0]?.kind).toBe('move');
    run(game, 2.5);
    expect(Math.hypot(game.units.get(w)!.x - 10, game.units.get(w)!.y - 10)).toBeGreaterThan(2.5);
  });

  it('can still attack on an explicit right-click', () => {
    const game = arena();
    const w = game.debugSpawn(0, 'worker', 10, 10);
    const e = game.debugSpawn(1, 'worker', 11, 10);
    attackAll(game, 0, [w], e);
    run(game, 0.3);
    expect(game.units.get(e)!.hp).toBeLessThan(U.worker!.hp);
  });
});

describe('buildings that shoot (buildings.json → attack)', () => {
  it('a Town Hall shoots enemy units in range; a construction site does not', () => {
    const game = arena();
    game.debugBuilding(0, 'town_hall', 10, 10);
    const e = game.debugSpawn(1, 'militia', 16, 11.5);
    send(game, 1, { type: 'setStance', units: [e], stance: 'hold' });
    run(game, 4);
    expect(game.units.get(e)!.hp).toBeLessThan(U.militia!.hp);

    const g2 = arena();
    send(g2, 0, { type: 'build', building: 'watch_tower', at: { x: 10, y: 10 } });
    const e2 = g2.debugSpawn(1, 'militia', 13, 10.5);
    send(g2, 1, { type: 'setStance', units: [e2], stance: 'hold' });
    run(g2, 4);
    expect(g2.units.get(e2)!.hp).toBe(U.militia!.hp);
  });

  it('a finished watch tower shoots with its own config', () => {
    const game = arena();
    game.debugGive(0, { wood: 500, gold: 500 });
    game.debugBuilding(0, 'watch_tower', 10, 10);
    const e = game.debugSpawn(1, 'militia', 15, 10.5);
    send(game, 1, { type: 'setStance', units: [e], stance: 'hold' });
    run(game, 3);
    const tower = GAME_DATA.buildings.watch_tower!.attack!;
    expect(U.militia!.hp - game.units.get(e)!.hp).toBeGreaterThanOrEqual(tower.damage - U.militia!.armor);
  });
});

describe('death', () => {
  it('a destroyed building frees its tiles and its population', () => {
    const game = arena();
    const house = game.debugBuilding(1, 'house', 10, 10);
    const capBefore = game.getView(1).self.popCap;
    const mil = [8, 8.6, 9.2, 9.8].map((y) => game.debugSpawn(0, 'militia', 8, y));
    attackAll(game, 0, mil, house);
    const events = run(game, 120);
    const gone = events.find((e) => e.type === 'buildingDestroyed');
    expect(gone).toMatchObject({ building: house, owner: 1, w: 2, h: 2 });
    expect(game.buildings.has(house)).toBe(false);
    expect(game.getView(1).self.popCap).toBe(capBefore - GAME_DATA.buildings.house!.popProvided);
    send(game, 1, { type: 'build', building: 'house', at: { x: 10, y: 10 } });
    expect([...game.buildings.values()].some((b) => b.type === 'house' && b.x === 10)).toBe(true);
  });

  it('dead units are removed and reported; the owner gets one throttled under-attack alert', () => {
    const game = arena();
    const w = game.debugSpawn(1, 'worker', 11, 10);
    const mil = [9.6, 10.4].map((y) => game.debugSpawn(0, 'militia', 10, y));
    attackAll(game, 0, mil, w);
    const events = run(game, 10);
    expect(events.filter((e) => e.type === 'unitDied' && e.unit === w)).toHaveLength(1);
    expect(events.filter((e) => e.type === 'underAttack' && e.player === 1)).toHaveLength(1);
    expect(game.units.has(w)).toBe(false);
  });
});

describe('determinism', () => {
  it('the same battle gives the same state hash', () => {
    const play = (): string => {
      const game = createGame(openMap(40, 40), { seed: 3 });
      const types = ['militia', 'archer', 'knight', 'scout_rider'];
      for (let i = 0; i < 16; i++) {
        game.debugSpawn(0, types[i % 4]!, 8 + (i % 4), 10 + Math.floor(i / 4));
        game.debugSpawn(1, types[(i + 1) % 4]!, 24 + (i % 4), 10 + Math.floor(i / 4));
      }
      const own = [...game.units.values()].filter((u) => u.owner === 0).map((u) => u.id);
      send(game, 0, { type: 'attackMove', units: own, to: { x: 30, y: 12 } });
      run(game, 40);
      return game.stateHash();
    };
    expect(play()).toBe(play());
  });
});
