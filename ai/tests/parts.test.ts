/** Unit tests for the machine player's parts: placement and budget. */
import { describe, expect, it } from 'vitest';
import { allocate, type Request } from '../Budget';
import { TileMap } from '../TileMap';
import { bestCounter } from '../counters';
import { PROFILES } from '../../src/ai';
import { createGame, GAME_DATA } from '../../src/engine';
import type { Command, ObservedUnit } from '../../src/shared';
import { openMap } from '../../tests/engine/helpers';

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
      gatherers: 0,
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

describe('counter pick (ai/counters.ts)', () => {
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
  const ALL = ['militia', 'guard', 'slinger', 'archer', 'scout_rider', 'knight'];
  const BARRACKS = ['militia', 'guard', 'slinger', 'archer'];

  it('answers each army with one of its counters in docs/units.md §1.3', () => {
    const best = (enemy: string, n: number) => bestCounter(GAME_DATA, ALL, army(enemy, n), edge);
    expect(['slinger', 'archer']).toContain(best('militia', 10));
    expect(['militia', 'slinger']).toContain(best('guard', 6));
    expect(['archer', 'scout_rider', 'knight']).toContain(best('slinger', 10));
    expect(['guard', 'scout_rider', 'knight']).toContain(best('archer', 10));
    expect(['militia', 'guard', 'knight']).toContain(best('scout_rider', 8));
    expect(['militia', 'guard']).toContain(best('knight', 5));
  });

  it('picks within what one building trains: the Barracks answers Knights with Militia', () => {
    expect(bestCounter(GAME_DATA, BARRACKS, army('knight', 5), edge)).toBe('militia');
    expect(bestCounter(GAME_DATA, BARRACKS, army('militia', 5), edge)).toBe('slinger');
    expect(bestCounter(GAME_DATA, BARRACKS, army('archer', 5), edge)).toBe('guard');
    expect(bestCounter(GAME_DATA, ['scout_rider', 'knight'], army('slinger', 5), edge)).toBe('knight');
  });

  it('without gold the answers stay inside the gold-free units', () => {
    const cheap = ['militia', 'slinger', 'scout_rider'];
    expect(bestCounter(GAME_DATA, cheap, army('militia', 10), edge)).toBe('slinger');
    expect(bestCounter(GAME_DATA, cheap, army('slinger', 10), edge)).toBe('scout_rider');
    expect(bestCounter(GAME_DATA, cheap, army('scout_rider', 8), edge)).toBe('militia');
  });

  it('with no enemy army there is no counter pick', () => {
    expect(bestCounter(GAME_DATA, ALL, [], edge)).toBeNull();
  });
});
