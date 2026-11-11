/**
 * Farms and siege in the machine player (docs/plans/m7b-farm-catapult.md §3). Slow headless
 * matches, so they have their own file.
 */
import { describe, expect, it } from 'vitest';
import { PROFILES } from '../../src/ai';
import { decodeMap, type PlayerId } from '../../src/shared';
import { createGame, GAME_DATA } from '../../src/engine';
import { TileMap } from '../TileMap';
import { GREEN_VALLEY, mapFile, match, type Match } from './sim';

const own = (m: Match, p: PlayerId, type: string) =>
  [...m.game.buildings.values()].filter((b) => b.owner === p && b.type === type);
const farmers = (m: Match, p: PlayerId): number => {
  const farms = new Set(own(m, p, 'farm').map((b) => b.id));
  return [...m.game.units.values()].filter((u) => {
    const o = u.orders[0];
    return u.owner === p && o?.kind === 'gather' && farms.has(o.target);
  }).length;
};

const soldiersTrained = (m: Match, p: PlayerId): number =>
  Object.entries(m.trained.get(p) ?? {})
    .filter(([type]) => type !== 'worker')
    .reduce((n, [, count]) => n + count, 0);

describe('Normal vs Normal, 20 minutes (standard start)', () => {
  it('farms once the berries run low, so it keeps training soldiers after the berries are gone', () => {
    // seed 2: a long, even match (most seeds now end with a winner before 20:00)
    const m = match({ scenario: false, ai: [0, 1], mode: 'normal', seed: 2 });
    m.run(12 * 60);
    const berries = [...m.game.nodes.values()].filter((n) => n.resource === 'food').length;
    expect(berries).toBe(0);
    const at12 = [soldiersTrained(m, 0), soldiersTrained(m, 1)];
    for (const p of [0, 1] as const) {
      // two farmers per Farm (buildings.json → farm.gather.slots)
      expect(own(m, p, 'farm').length, `player ${p} farms`).toBeGreaterThanOrEqual(2);
      expect(farmers(m, p), `player ${p} farmers`).toBeGreaterThanOrEqual(3);
    }
    m.run(8 * 60);
    for (const p of [0, 1] as const) {
      expect(soldiersTrained(m, p), `player ${p} keeps training`).toBeGreaterThan(at12[p]! + 10);
      expect(own(m, p, 'farm').length).toBeLessThanOrEqual(PROFILES.normal.buildings.maxFarms);
      // siege: a Workshop after buildings.siegeAfterSeconds, and Catapults up to army.maxSiege
      expect(own(m, p, 'siege_workshop').length, `player ${p} workshop`).toBeLessThanOrEqual(1);
      expect(m.trained.get(p)?.catapult ?? 0, `player ${p} catapults`).toBeGreaterThan(0);
      const alive = [...m.game.units.values()].filter((u) => u.owner === p && u.type === 'catapult');
      expect(alive.length).toBeLessThanOrEqual(PROFILES.normal.army.maxSiege);
    }
  }, 180_000);

  it('uses the whole roster: both sides train foot soldiers, shooters and riders, gold-free and gold', () => {
    const m = match({ scenario: false, ai: [0, 1], mode: 'normal', seed: 2 });
    m.run(16 * 60);
    for (const p of [0, 1] as const) {
      const t = m.trained.get(p) ?? {};
      for (const unit of ['militia', 'guard', 'slinger', 'archer', 'scout_rider', 'knight'])
        expect(t[unit] ?? 0, `player ${p} ${unit}`).toBeGreaterThan(0);
    }
  }, 180_000);
});

describe('Easy', () => {
  it('never builds a Siege Workshop or trains a Catapult, and builds at most buildings.maxFarms farms', () => {
    const m = match({ scenario: false, ai: [0, 1], mode: 'easy', seed: 5 });
    m.run(20 * 60);
    for (const p of [0, 1] as const) {
      expect(own(m, p, 'siege_workshop').length).toBe(0);
      expect(m.trained.get(p)?.catapult ?? 0).toBe(0);
      expect(own(m, p, 'farm').length).toBeLessThanOrEqual(PROFILES.easy.buildings.maxFarms);
    }
  }, 180_000);
});

describe('room for farms', () => {
  it.each(['green_valley', 'twin_rivers', 'forest_pass'])(
    '%s: Normal finds room for all its farms around both bases',
    (id) => {
      const map = id === 'green_valley' ? GREEN_VALLEY : mapFile(id);
      const game = createGame(decodeMap(map), { seed: 1 });
      const [w, h] = GAME_DATA.buildings.farm!.footprint;
      const [near, far] = PROFILES.normal.buildings.farmDistance;
      for (const p of [0, 1] as const) {
        const info = game.staticInfo(p);
        const obs = game.observe(p);
        const hall = obs.buildings.find((b) => b.owner === p && b.type === 'town_hall')!;
        const enemy = obs.buildings.find((b) => b.owner !== p && b.type === 'town_hall')!;
        const at = { x: hall.x + hall.w / 2, y: hall.y + hall.h / 2 };
        const dx = enemy.x - hall.x;
        const dy = enemy.y - hall.y;
        const len = Math.hypot(dx, dy);
        const tiles = new TileMap(info);
        const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
        for (let i = 0; i < PROFILES.normal.buildings.maxFarms; i++) {
          tiles.update(obs, placed);
          const spot = tiles.findSpot({
            w,
            h,
            around: at,
            front: { x: dx / len, y: dy / len },
            side: 'back',
            near,
            far: far + 6,
          });
          expect(spot, `player ${p} farm ${i + 1}`).not.toBeNull();
          placed.push({ ...spot!, w, h });
        }
      }
    },
  );
});
