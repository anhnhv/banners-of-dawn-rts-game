/** Unit tests for the machine player's parts: placement and budget. */
import { describe, expect, it } from 'vitest';
import { allocate, type Request } from '../../src/ai/Budget';
import { TileMap } from '../../src/ai/TileMap';
import { bestCounter } from '../../src/ai/counters';
import { PROFILES } from '../../src/ai/profiles';
import { createGame, GAME_DATA } from '../../src/engine';
import type { Command, ObservedUnit } from '../../src/shared';
import { openMap } from '../engine/helpers';

function req(label: string, priority: number, cost: Request['cost']): Request {
  return { label, priority, cost, commit: (): Command[] => [{ type: 'stop', units: [] }] };
}

describe('Budget', () => {
  it('approves by priority and saves for the first request it cannot afford', () => {
    const r = allocate({ food: 100, wood: 40, gold: 0 }, [
      req('militia', 60, { food: 35, wood: 20 }),
      req('house', 90, { wood: 30 }),
      req('worker', 80, { food: 50 }),
    ]);
    expect(r.approved).toEqual(['house', 'worker']);
    expect(r.saving).toBe('militia');
  });

  it('a reservation keeps cheaper, lower requests from spending what it needs', () => {
    const r = allocate({ food: 0, wood: 100, gold: 0 }, [
      req('barracks', 70, { wood: 150 }),
      req('house', 50, { wood: 30 }),
    ]);
    expect(r.approved).toEqual([]);
    expect(r.saving).toBe('barracks');
  });
});

describe('TileMap placement', () => {
  it('keeps a free ring around every footprint and prefers the requested side', () => {
    const game = createGame(openMap(30, 30), { seed: 1 });
    const info = game.staticInfo(0);
    const map = new TileMap(info);
    const obs = game.observe(0);
    obs.buildings.push({
      id: 999,
      owner: 0,
      type: 'town_hall',
      x: 13,
      y: 13,
      w: 3,
      h: 3,
      hp: 1,
      maxHp: 1,
      constructed: true,
      queue: [],
      rally: null,
    });
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (let i = 0; i < 10; i++) {
      map.update(obs, placed);
      const spot = map.findSpot({
        w: 2,
        h: 2,
        around: { x: 14.5, y: 14.5 },
        front: { x: 1, y: 0 },
        side: 'back',
        near: 5,
        far: 12,
      });
      expect(spot).not.toBeNull();
      if (!spot) return;
      for (const p of [...placed, { x: 13, y: 13, w: 3, h: 3 }]) {
        const gapX = Math.max(p.x - (spot.x + 2), spot.x - (p.x + p.w));
        const gapY = Math.max(p.y - (spot.y + 2), spot.y - (p.y + p.h));
        expect(Math.max(gapX, gapY)).toBeGreaterThanOrEqual(1);
      }
      placed.push({ ...spot, w: 2, h: 2 });
    }
    // "back" = away from the enemy (front is +x): most houses are left of the Town Hall
    expect(placed.filter((p) => p.x + 1 < 14.5).length).toBeGreaterThan(placed.length / 2);
  });
});

describe('counter pick (src/ai/counters.ts)', () => {
  const army = (type: string, n: number): ObservedUnit[] =>
    Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      owner: 1,
      type,
      x: 0,
      y: 0,
      hp: GAME_DATA.units[type]!.hp,
      maxHp: GAME_DATA.units[type]!.hp,
      stance: 'aggressive' as const,
      order: { kind: 'idle' as const },
    }));
  const edge = PROFILES.normal.army.counterRangedEdge;
  const ALL = ['militia', 'archer', 'scout_rider', 'knight'];

  it('answers each army the way docs/units.md says', () => {
    expect(bestCounter(GAME_DATA, ALL, army('militia', 10), edge)).toBe('archer');
    expect(bestCounter(GAME_DATA, ALL, army('knight', 5), edge)).toBe('militia');
    expect(bestCounter(GAME_DATA, ALL, army('scout_rider', 8), edge)).toBe('militia');
    expect(['scout_rider', 'knight']).toContain(bestCounter(GAME_DATA, ALL, army('archer', 10), edge));
  });

  it('picks within what one building trains: the Barracks answers Knights with Militia', () => {
    expect(bestCounter(GAME_DATA, ['militia', 'archer'], army('knight', 5), edge)).toBe('militia');
    expect(bestCounter(GAME_DATA, ['militia', 'archer'], army('militia', 5), edge)).toBe('archer');
  });

  it('with no enemy army there is no counter pick', () => {
    expect(bestCounter(GAME_DATA, ALL, [], edge)).toBeNull();
  });
});
