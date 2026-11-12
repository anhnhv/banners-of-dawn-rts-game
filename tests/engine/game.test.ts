import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createGame, GAME_DATA, type Game } from '../../src/engine';
import { decodeMap, type Command, type PlayerId } from '../../src/shared';
import { asciiMap, openMap } from './helpers';

function send(game: Game, player: PlayerId, cmd: Command): void {
  game.enqueue({ player, tick: game.tick, cmd });
}

function run(game: Game, ticks: number): void {
  for (let i = 0; i < ticks; i++) game.step();
}

describe('Game: movement', () => {
  it('moves a unit to the clicked point', () => {
    const game = createGame(openMap(30, 30), { seed: 1 });
    const id = game.debugSpawn(0, 'militia', 2.5, 2.5);
    send(game, 0, { type: 'move', units: [id], to: { x: 20.25, y: 12.75 } });
    run(game, 20 * 12); // 12 seconds
    const u = game.units.get(id)!;
    expect(u.x).toBeCloseTo(20.25, 1);
    expect(u.y).toBeCloseTo(12.75, 1);
    expect(u.orders).toHaveLength(0);
    expect(u.moving).toBe(false);
  });

  it('moves at the unit speed (units.json → militia.speed)', () => {
    const game = createGame(openMap(40, 5), { seed: 1 });
    const id = game.debugSpawn(0, 'militia', 1.5, 2.5);
    send(game, 0, { type: 'move', units: [id], to: { x: 35.5, y: 2.5 } });
    run(game, 20 * 5);
    const u = game.units.get(id)!;
    expect(u.x - 1.5).toBeGreaterThan(GAME_DATA.units.militia!.speed * 5 - 0.6);
    expect(u.x - 1.5).toBeLessThan(GAME_DATA.units.militia!.speed * 5 + 0.1);
  });

  it('walks around a wall and never stands on blocked tiles', () => {
    const rows = Array.from({ length: 20 }, (_, y) =>
      y >= 2 && y <= 17 ? '..........#.........' : '....................',
    );
    const game = createGame(asciiMap(rows), { seed: 1 });
    const id = game.debugSpawn(0, 'worker', 3.5, 10.5);
    send(game, 0, { type: 'move', units: [id], to: { x: 16.5, y: 10.5 } });
    for (let t = 0; t < 20 * 20; t++) {
      game.step();
      const u = game.units.get(id)!;
      expect(game.units.size).toBe(1);
      expect(rows[Math.floor(u.y)]?.[Math.floor(u.x)]).toBe('.');
    }
    const u = game.units.get(id)!;
    expect(Math.hypot(u.x - 16.5, u.y - 10.5)).toBeLessThan(0.1);
  });

  it('moves 50 units as a group around an obstacle; all arrive, none on blocked tiles, none stacked', () => {
    const rows = Array.from({ length: 40 }, (_, y) =>
      Array.from({ length: 40 }, (_, x) => (x >= 18 && x <= 21 && y >= 5 && y <= 34 ? '#' : '.')).join(''),
    );
    const game = createGame(asciiMap(rows), { seed: 7 });
    const ids: number[] = [];
    for (let i = 0; i < 50; i++) {
      const type = (['militia', 'archer', 'knight', 'worker', 'scout_rider'] as const)[i % 5];
      ids.push(game.debugSpawn(0, type, 4 + (i % 7) * 0.8, 15 + Math.floor(i / 7) * 0.8));
    }
    send(game, 0, { type: 'move', units: ids, to: { x: 32, y: 20 } });
    run(game, 20 * 40);
    for (const id of ids) {
      const u = game.units.get(id)!;
      expect(rows[Math.floor(u.y)]?.[Math.floor(u.x)]).toBe('.');
      expect(u.orders).toHaveLength(0);
      expect(u.x).toBeGreaterThan(22); // all made it past the wall
      expect(Math.hypot(u.x - 32, u.y - 20)).toBeLessThan(6);
    }
    // no two units deeply overlapping
    const list = ids.map((id) => game.units.get(id)!);
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan((a.radius + b.radius) * 0.5);
      }
  });

  it('queues moves with shift', () => {
    const game = createGame(openMap(30, 30), { seed: 1 });
    const id = game.debugSpawn(0, 'knight', 2.5, 2.5);
    send(game, 0, { type: 'move', units: [id], to: { x: 10.5, y: 2.5 } });
    send(game, 0, { type: 'move', units: [id], to: { x: 10.5, y: 12.5 }, queue: true });
    game.step();
    expect(game.units.get(id)!.orders).toHaveLength(2);
    run(game, 20 * 10);
    const u = game.units.get(id)!;
    expect(u.orders).toHaveLength(0);
    expect(u.x).toBeCloseTo(10.5, 1);
    expect(u.y).toBeCloseTo(12.5, 1);
  });

  it('walks around a standing unit: never touches it, never pushes it', () => {
    const game = createGame(openMap(30, 30), { seed: 1 });
    const idle = game.debugSpawn(0, 'militia', 10.5, 10.5);
    const other = game.debugSpawn(0, 'worker', 14.5, 10.6);
    const walker = game.debugSpawn(0, 'knight', 4.5, 10.5);
    const start = (id: number): [number, number] => [game.units.get(id)!.x, game.units.get(id)!.y];
    const [ix, iy] = start(idle);
    const [ex, ey] = start(other);
    send(game, 0, { type: 'move', units: [walker], to: { x: 20.5, y: 10.5 } });
    let closest = Infinity;
    for (let t = 0; t < 20 * 10; t++) {
      game.step();
      const w = game.units.get(walker)!;
      for (const id of [idle, other]) {
        const o = game.units.get(id)!;
        closest = Math.min(closest, Math.hypot(o.x - w.x, o.y - w.y) - o.radius - w.radius);
      }
    }
    expect(closest).toBeGreaterThan(0);
    expect(game.units.get(idle)!.x).toBe(ix);
    expect(game.units.get(idle)!.y).toBe(iy);
    expect(game.units.get(other)!.x).toBe(ex);
    expect(game.units.get(other)!.y).toBe(ey);
    const w = game.units.get(walker)!;
    expect(w.orders).toHaveLength(0);
    expect(Math.hypot(w.x - 20.5, w.y - 10.5)).toBeLessThan(0.1);
  });

  it('two units walking head-on pass each other without touching', () => {
    const game = createGame(openMap(30, 30), { seed: 1 });
    const a = game.debugSpawn(0, 'militia', 4.5, 10.5);
    const b = game.debugSpawn(0, 'militia', 20.5, 10.5);
    send(game, 0, { type: 'move', units: [a], to: { x: 20.5, y: 10.5 } });
    send(game, 0, { type: 'move', units: [b], to: { x: 4.5, y: 10.5 } });
    let closest = Infinity;
    for (let t = 0; t < 20 * 12; t++) {
      game.step();
      const ua = game.units.get(a)!;
      const ub = game.units.get(b)!;
      closest = Math.min(closest, Math.hypot(ua.x - ub.x, ua.y - ub.y) - ua.radius - ub.radius);
    }
    expect(closest).toBeGreaterThan(0);
    expect(Math.hypot(game.units.get(a)!.x - 20.5, game.units.get(a)!.y - 10.5)).toBeLessThan(0.1);
    expect(Math.hypot(game.units.get(b)!.x - 4.5, game.units.get(b)!.y - 10.5)).toBeLessThan(0.1);
  });

  it('a unit boxed in by idle friends gets out: they step aside by themselves', () => {
    const game = createGame(openMap(30, 30), { seed: 1 });
    const ring: number[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      ring.push(game.debugSpawn(0, 'militia', 10.5 + Math.cos(a) * 0.55, 10.5 + Math.sin(a) * 0.55));
    }
    const inside = game.debugSpawn(0, 'militia', 10.5, 10.5);
    send(game, 0, { type: 'move', units: [inside], to: { x: 20.5, y: 10.5 } });
    run(game, 20 * 15);
    const u = game.units.get(inside)!;
    expect(Math.hypot(u.x - 20.5, u.y - 10.5)).toBeLessThan(0.1);
    // the ring is still about where it was: only a step aside, nobody got shoved across the map
    for (const id of ring)
      expect(Math.hypot(game.units.get(id)!.x - 10.5, game.units.get(id)!.y - 10.5)).toBeLessThan(2);
  });

  it('stops on command', () => {
    const game = createGame(openMap(30, 30), { seed: 1 });
    const id = game.debugSpawn(0, 'militia', 2.5, 2.5);
    send(game, 0, { type: 'move', units: [id], to: { x: 25, y: 25 } });
    run(game, 20);
    send(game, 0, { type: 'stop', units: [id] });
    run(game, 2);
    const x = game.units.get(id)!.x;
    run(game, 40);
    expect(game.units.get(id)!.x).toBe(x);
    expect(game.units.get(id)!.moving).toBe(false);
  });

  it("rejects commands for the other player's units", () => {
    const game = createGame(openMap(20, 20), { seed: 1 });
    const enemy = game.debugSpawn(1, 'militia', 10.5, 10.5);
    send(game, 0, { type: 'move', units: [enemy], to: { x: 2, y: 2 } });
    const events = game.step();
    expect(events).toEqual([{ type: 'commandRejected', player: 0, reason: 'NO_UNITS' }]);
    run(game, 40);
    expect(game.units.get(enemy)!.x).toBe(10.5);
  });

  it('exposes positions and previous positions in the player view', () => {
    const game = createGame(openMap(20, 20), { seed: 1 });
    const id = game.debugSpawn(0, 'militia', 2.5, 2.5);
    send(game, 0, { type: 'move', units: [id], to: { x: 15, y: 2.5 } });
    run(game, 5);
    const v = game.getView(0).units.find((u) => u.id === id)!;
    expect(v.x).toBeGreaterThan(v.prevX);
    expect(v.moving).toBe(true);
    expect(game.getView(0)).toBe(game.getView(0)); // cached within a tick
  });
});

describe('Game: start and determinism', () => {
  const greenValley = decodeMap(
    JSON.parse(readFileSync(new URL('../../maps/green_valley.json', import.meta.url), 'utf8')),
  );

  it('spawns the starting units of both players around their Town Halls', () => {
    const game = createGame(greenValley, { seed: 3 });
    const units = [...game.units.values()];
    expect(units.filter((u) => u.owner === 0 && u.type === 'worker')).toHaveLength(3);
    expect(units.filter((u) => u.owner === 1 && u.type === 'scout_rider')).toHaveLength(1);
    expect(units).toHaveLength(8);
  });

  it('is deterministic: same seed and commands give the same state', () => {
    const play = (): string => {
      const game = createGame(greenValley, { seed: 42, testArmy: 30 });
      const mine = [...game.units.values()].filter((u) => u.owner === 0).map((u) => u.id);
      send(game, 0, { type: 'move', units: mine, to: { x: 40, y: 40 } });
      run(game, 200);
      send(game, 0, { type: 'move', units: mine.slice(0, 10), to: { x: 50, y: 30 }, queue: true });
      run(game, 400);
      return game.stateHash();
    };
    expect(play()).toBe(play());
  });
});
