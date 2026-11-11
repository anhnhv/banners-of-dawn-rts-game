/** Ready-made map scenario start (PLAN §8.1). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeMap, type MapFile } from '../../src/shared';
import { createGame, GAME_DATA, validateMap, type Game } from '../../src/engine';

const GREEN_VALLEY = JSON.parse(
  readFileSync(new URL('../../maps/green_valley.json', import.meta.url), 'utf8'),
) as MapFile;

function run(game: Game, seconds: number): void {
  for (let i = 0; i < seconds * 20; i++) game.step();
}

function scenarioGame(file: MapFile = GREEN_VALLEY): Game {
  return createGame(decodeMap(file), { seed: 3, scenario: true });
}

describe('map scenario', () => {
  it('is off unless asked for: the standard start is the Town Hall and map start.units', () => {
    const game = createGame(decodeMap(GREEN_VALLEY), { seed: 3 });
    expect(game.buildings.size).toBe(2);
    const perPlayer = GREEN_VALLEY.start.units.reduce((n, [, c]) => n + c, 0);
    expect(game.units.size).toBe(perPlayer * 2);
    expect(game.player(0).resources).toEqual(GAME_DATA.game.startingResources);
  });

  it('places the listed buildings, units and resources for both players', () => {
    const game = scenarioGame();
    const setup = GREEN_VALLEY.scenario?.players ?? [];
    for (const p of setup) {
      const owner = p.player === 1 ? 0 : 1;
      const buildings = [...game.buildings.values()].filter((b) => b.owner === owner);
      expect(buildings).toHaveLength((p.buildings?.length ?? 0) + 1); // + Town Hall
      expect(buildings.every((b) => b.constructed && b.hp === b.maxHp)).toBe(true);
      const units = [...game.units.values()].filter((u) => u.owner === owner);
      expect(units).toHaveLength((p.units ?? []).reduce((n, g) => n + (g.count ?? 1), 0));
      for (const [r, v] of Object.entries(p.resources ?? {}))
        expect(game.player(owner).resources[r as 'food']).toBe(v);
    }
  });

  it('workers start gathering at once and the stockpile grows', () => {
    const game = scenarioGame();
    const before = { ...game.player(0).resources };
    game.step();
    const workers = [...game.units.values()].filter((u) => u.type === 'worker');
    expect(workers.length).toBeGreaterThan(0);
    expect(workers.every((u) => u.orders[0]?.kind === 'gather')).toBe(true);
    run(game, 30);
    const after = game.player(0).resources;
    expect(after.food).toBeGreaterThan(before.food);
    expect(after.wood).toBeGreaterThan(before.wood);
    expect(after.gold).toBeGreaterThan(before.gold);
  });

  it('the enemy army stands outside the reach of its own base defences, and nobody fights at start', () => {
    const game = scenarioGame();
    const army = [...game.units.values()].filter((u) => u.owner === 1 && u.type !== 'worker');
    expect(army.length).toBeGreaterThan(0);
    for (const b of game.buildings.values()) {
      const range = GAME_DATA.buildings[b.type]?.attack?.range;
      if (b.owner !== 1 || range === undefined) continue;
      for (const u of army) {
        const dx = Math.max(b.x - u.x, 0, u.x - (b.x + b.w));
        const dy = Math.max(b.y - u.y, 0, u.y - (b.y + b.h));
        expect(Math.hypot(dx, dy)).toBeGreaterThan(range + 4);
      }
    }
    run(game, 15);
    for (const u of game.units.values()) expect(u.hp).toBe(u.maxHp);
  });

  it('the validator reports bad scenario entries', () => {
    const file = structuredClone(GREEN_VALLEY);
    const p1 = file.scenario?.players[0];
    if (!p1) throw new Error('Green Valley has no scenario');
    p1.buildings = [
      { type: 'castle_of_doom', at: [60, 50], constructed: true },
      { type: 'house', at: [59, 58], constructed: true }, // on the Town Hall
      { type: 'house', at: [79, 79], constructed: true }, // sticks out
    ];
    p1.units = [
      { type: 'dragon', at: [50, 50], count: 1 },
      { type: 'militia', at: [50, 50], count: 1, gather: 'wood' },
      { type: 'archer', at: [120, 5], count: 1 },
    ];
    p1.resources = { mana: 5 };
    const errors = validateMap(decodeMap(file)).errors.join('\n');
    expect(errors).toMatch(/unknown building "castle_of_doom"/);
    expect(errors).toMatch(/house at 59,58 does not fit/);
    expect(errors).toMatch(/house at 79,79 does not fit/);
    expect(errors).toMatch(/unknown unit "dragon"/);
    expect(errors).toMatch(/militia at 50,50 cannot gather "wood"/);
    expect(errors).toMatch(/archer at 120,5 is outside the map/);
    expect(errors).toMatch(/unknown resource "mana"/);
  });

  it('each side has a Barracks (foot soldiers and shooters) and a Stable (riders) whose units get out', () => {
    const game = scenarioGame();
    const trains = (type: string): string[] =>
      (GAME_DATA.buildings[type]?.actions ?? []).flatMap((a) => (a.type === 'train' ? [a.unit] : []));
    expect(trains('barracks')).toEqual(['militia', 'guard', 'slinger', 'archer']);
    expect(trains('stable')).toEqual(['scout_rider', 'knight']);
    expect(GAME_DATA.game.buildMenu.map((m) => m.building)).toContain('stable');
    const before = new Set(game.units.keys());
    for (const owner of [0, 1] as const) {
      game.debugGive(owner, { food: 1000, wood: 1000, gold: 1000 });
      game.debugBuilding(owner, 'house', owner === 0 ? 66 : 12, owner === 0 ? 50 : 28); // room for 10 more
      game.debugBuilding(owner, 'house', owner === 0 ? 66 : 12, owner === 0 ? 53 : 25);
      for (const type of ['barracks', 'stable']) {
        const b = [...game.buildings.values()].find((x) => x.owner === owner && x.type === type);
        expect(b, `${type} of player ${owner}`).toBeDefined();
        for (const unit of trains(type))
          game.enqueue({ player: owner, tick: game.tick, cmd: { type: 'train', building: b!.id, unit } });
      }
    }
    run(game, 90);
    const fresh = [...game.units.values()].filter((u) => !before.has(u.id));
    expect(fresh.map((u) => `${u.owner}:${u.type}`).sort()).toEqual(
      ['archer', 'guard', 'knight', 'militia', 'scout_rider', 'slinger']
        .flatMap((t) => [`0:${t}`, `1:${t}`])
        .sort(),
    );
    // every new unit can walk out of its base (to a spot away from both armies)
    const out = { 0: { x: 64, y: 47 }, 1: { x: 16, y: 33 } } as const;
    for (const owner of [0, 1] as const)
      game.enqueue({
        player: owner,
        tick: game.tick,
        cmd: {
          type: 'move',
          units: fresh.filter((u) => u.owner === owner).map((u) => u.id),
          to: out[owner],
        },
      });
    run(game, 40);
    for (const u of fresh) {
      const now = game.units.get(u.id);
      const to = out[u.owner as 0 | 1];
      expect(now, `${u.type} of player ${u.owner}`).toBeDefined();
      expect(Math.hypot(now!.x - to.x, now!.y - to.y)).toBeLessThan(3);
    }
  });

  it('is deterministic', () => {
    const a = scenarioGame();
    const b = scenarioGame();
    run(a, 20);
    run(b, 20);
    expect(a.stateHash()).toBe(b.stateHash());
  });
});
