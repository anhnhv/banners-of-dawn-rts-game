/**
 * Army balance (docs/units.md). The four rules for the army units, as tests:
 *   1. a clear role and 3. a situation where it has the advantage: one situation test per unit;
 *   2. an exploitable weakness: the matrix losses and the building-damage check;
 *   4. no unit is best everywhere: every unit loses at least one equal-cost matchup.
 * Army sizes come from the costs in units.json, so retuning the data keeps the tests meaningful.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createGame, GAME_DATA, type Game } from '../../src/engine';
import type { EntityId, PlayerId, UnitTypeId } from '../../src/shared';
import { tableAfter } from '../docs/markdown';
import { node, openMap } from './helpers';

const U = GAME_DATA.units;
const ARMY = ['militia', 'archer', 'scout_rider', 'knight'] as const;
type ArmyUnit = (typeof ARMY)[number];

/** Resource value of one unit (food + wood + gold). */
function value(type: string): number {
  return Object.values(U[type]!.cost).reduce((a, b) => a + (b ?? 0), 0);
}

/** Value still standing: each unit's cost × its HP share. */
function valueLeft(game: Game, ids: EntityId[]): number {
  let v = 0;
  for (const id of ids) {
    const u = game.units.get(id);
    if (u) v += (u.hp / U[u.type]!.hp) * value(u.type);
  }
  return v;
}

type Army = Array<[ArmyUnit, number]>; // unit type, share of the budget

function spawnArmy(
  game: Game,
  owner: PlayerId,
  army: Army,
  budget: number,
  x0: number,
  dir: 1 | -1,
): EntityId[] {
  const ids: EntityId[] = [];
  for (const [type, share] of army) {
    const n = Math.max(1, Math.round((budget * share) / value(type)));
    const back = U[type]!.attack!.range > 0 ? 3 : 0; // shooters stand behind the line
    for (let k = 0; k < n; k++)
      ids.push(
        game.debugSpawn(owner, type, x0 - dir * (back + (k % 3)), 8 + Math.floor(k / 3) + (back ? 0.5 : 0)),
      );
  }
  return ids;
}

function center(game: Game, ids: EntityId[]): { x: number; y: number } {
  const live = ids.map((id) => game.units.get(id)).filter((u) => u !== undefined);
  return {
    x: live.reduce((s, u) => s + u.x, 0) / live.length,
    y: live.reduce((s, u) => s + u.y, 0) / live.length,
  };
}

interface FightResult {
  winner: 'a' | 'b';
  /** Share of the winner's army value still standing (0..1). */
  left: number;
}

/**
 * Equal-cost field battle: both armies attack-move at each other. Units whose order ran out are
 * sent at the other army again, so the fight always ends with one side gone (or after 3 minutes,
 * the side with more value left wins).
 */
function fight(a: Army, b: Army, budget: number): FightResult {
  const game = createGame(openMap(70, 30), { seed: 3 });
  const A = spawnArmy(game, 0, a, budget, 14, 1);
  const B = spawnArmy(game, 1, b, budget, 56, -1);
  const send = (owner: PlayerId, mine: EntityId[], theirs: EntityId[]): void => {
    const idle = mine.filter((id) => game.units.get(id)?.orders.length === 0);
    if (idle.length)
      game.enqueue({
        player: owner,
        tick: game.tick,
        cmd: { type: 'attackMove', units: idle, to: center(game, theirs) },
      });
  };
  game.enqueue({ player: 0, tick: 0, cmd: { type: 'attackMove', units: A, to: { x: 62, y: 12 } } });
  game.enqueue({ player: 1, tick: 0, cmd: { type: 'attackMove', units: B, to: { x: 8, y: 12 } } });
  for (let t = 0; t < 180 * 20; t++) {
    game.step();
    const la = A.filter((id) => game.units.has(id));
    const lb = B.filter((id) => game.units.has(id));
    if (la.length === 0 || lb.length === 0) break;
    if (t % 20 === 0) {
      send(0, la, lb);
      send(1, lb, la);
    }
  }
  const va = valueLeft(game, A);
  const vb = valueLeft(game, B);
  const total = (army: Army): number =>
    army.reduce(
      (s, [type, share]) => s + Math.max(1, Math.round((budget * share) / value(type))) * value(type),
      0,
    );
  return va >= vb ? { winner: 'a', left: va / total(a) } : { winner: 'b', left: vb / total(b) };
}

/** docs/units.md §1: the row unit beats these column units at equal cost. */
const BEATS: Record<ArmyUnit, ArmyUnit[]> = {
  militia: ['scout_rider', 'knight'],
  archer: ['militia'],
  scout_rider: ['archer'],
  knight: ['archer', 'scout_rider'],
};

describe('equal-cost matchups (docs/units.md §1)', () => {
  for (const budget of [400, 800]) {
    for (let i = 0; i < ARMY.length; i++) {
      for (let j = i + 1; j < ARMY.length; j++) {
        const a = ARMY[i]!;
        const b = ARMY[j]!;
        const expected = BEATS[a].includes(b) ? a : b;
        it(`${budget} a side: ${a} vs ${b} → ${expected} wins`, () => {
          const r = fight([[a, 1]], [[b, 1]], budget);
          if (process.env.BALANCE_LOG) console.log(budget, a, b, r.winner === 'a' ? a : b, r.left.toFixed(2));
          expect(r.winner === 'a' ? a : b).toBe(expected);
          expect(r.left).toBeGreaterThan(0.25); // a clear win, not a coin flip
        });
      }
    }
  }

  it('docs/units.md §1 shows the same matrix', () => {
    const rows = tableAfter(
      readFileSync(new URL('../../docs/units.md', import.meta.url), 'utf8'),
      '## 1. The counter cycle',
    );
    for (const [i, a] of ARMY.entries())
      for (const [j, b] of ARMY.entries()) {
        const cell = rows[i]![j + 1];
        expect(cell, `${a} vs ${b}`).toBe(a === b ? '—' : BEATS[a].includes(b) ? 'wins' : 'loses');
      }
  });

  it('rule 4: every unit loses at least one matchup and wins at least one', () => {
    for (const unit of ARMY) {
      const losses = ARMY.filter((other) => other !== unit && !BEATS[unit].includes(other));
      expect(losses.length, unit).toBeGreaterThan(0);
      expect(BEATS[unit].length, unit).toBeGreaterThan(0);
      for (const other of losses) expect(BEATS[other], `${other} should beat ${unit}`).toContain(unit);
    }
  });
});

describe('army mixes (docs/units.md §3)', () => {
  const MIXES: Record<string, Army> = {
    militia: [['militia', 1]],
    archer: [['archer', 1]],
    scout_rider: [['scout_rider', 1]],
    knight: [['knight', 1]],
    'militia+archer': [
      ['militia', 0.5],
      ['archer', 0.5],
    ],
    'militia+knight': [
      ['militia', 0.5],
      ['knight', 0.5],
    ],
    'archer+knight': [
      ['archer', 0.5],
      ['knight', 0.5],
    ],
    'all four': [
      ['militia', 0.25],
      ['archer', 0.25],
      ['scout_rider', 0.25],
      ['knight', 0.25],
    ],
  };
  /** One equal-cost answer to each mix: no army is the best choice everywhere. */
  const ANSWER: Record<string, string> = {
    militia: 'militia+archer',
    archer: 'archer+knight',
    scout_rider: 'militia',
    knight: 'militia',
    'militia+archer': 'archer+knight',
    'militia+knight': 'militia+archer',
    'archer+knight': 'militia+knight',
    'all four': 'militia+archer',
  };
  for (const [name, army] of Object.entries(MIXES)) {
    it(`${name} is beaten by ${ANSWER[name]}`, () => {
      const r = fight(MIXES[ANSWER[name]!]!, army, 800);
      expect(r.winner).toBe('a');
    });
  }
});

describe('weaknesses (docs/units.md §2)', () => {
  const hit = (attacker: string, armor: number, cls: string): number => {
    const a = U[attacker]!.attack!;
    return Math.max(GAME_DATA.game.combat.minDamage, a.damage + (a.bonus[cls] ?? 0) - armor);
  };

  it('archers and scout riders barely hurt buildings and towers (minimum damage)', () => {
    for (const type of ['town_hall', 'house', 'watch_tower']) {
      const b = GAME_DATA.buildings[type]!;
      const cls = b.class ?? 'building';
      for (const unit of ['archer', 'scout_rider'])
        expect(hit(unit, b.armor, cls), `${unit} vs ${type}`).toBe(GAME_DATA.game.combat.minDamage);
      for (const unit of ['militia', 'knight'])
        expect(hit(unit, b.armor, cls), `${unit} vs ${type}`).toBeGreaterThan(
          GAME_DATA.game.combat.minDamage,
        );
    }
  });

  it('militia are the slowest army unit; the scout rider is the fastest unit of all', () => {
    const speeds = ARMY.map((t) => U[t]!.speed);
    expect(Math.min(...speeds)).toBe(U.militia!.speed);
    for (const [type, def] of Object.entries(U))
      if (type !== 'scout_rider') expect(def.speed, type).toBeLessThan(U.scout_rider!.speed);
  });

  it('knights cost gold and two population; militia and scout riders cost no gold', () => {
    expect(U.knight!.cost.gold ?? 0).toBeGreaterThan(0);
    expect(U.knight!.pop).toBe(2);
    expect(U.militia!.cost.gold ?? 0).toBe(0);
    expect(U.scout_rider!.cost.gold ?? 0).toBe(0);
  });
});

describe('where each unit shines (docs/units.md §2)', () => {
  it('Militia: a Knight charge into an equal-cost Militia block loses', () => {
    const r = fight([['knight', 1]], [['militia', 1]], 600);
    expect(r.winner).toBe('b');
  });

  it('Archer: archers behind a Militia line beat an all-Militia army of the same cost clearly', () => {
    const mixed = fight(
      [
        ['militia', 0.5],
        ['archer', 0.5],
      ],
      [['militia', 1]],
      800,
    );
    if (process.env.BALANCE_LOG) console.log('militia+archer vs militia', mixed);
    expect(mixed.winner).toBe('a');
    expect(mixed.left).toBeGreaterThan(0.3);
  });

  it('Scout Rider: in a 15 s raid on gathering workers it kills more worker value per resource than Knights', () => {
    const raid = (type: ArmyUnit): number => {
      const bushes = Array.from({ length: 4 }, (_, i) => node('berry_bush', 30 + i * 2, 15, 500));
      const game = createGame(openMap(50, 30, bushes), { seed: 3 });
      const workers: EntityId[] = [];
      for (let i = 0; i < 8; i++)
        workers.push(game.debugSpawn(1, 'worker', 30 + (i % 4) * 2, 14 + Math.floor(i / 4) * 2.2));
      game.step();
      for (const [i, w] of workers.entries())
        game.enqueue({
          player: 1,
          tick: game.tick,
          cmd: { type: 'interact', units: [w], target: [...game.nodes.keys()][i % 4]! },
        });
      const n = Math.max(1, Math.round(400 / value(type)));
      const raiders = Array.from({ length: n }, (_, i) => game.debugSpawn(0, type, 5, 10 + i));
      game.enqueue({
        player: 0,
        tick: game.tick,
        cmd: { type: 'attackMove', units: raiders, to: { x: 34, y: 15 } },
      });
      for (let t = 0; t < 15 * 20; t++) {
        game.step();
        if (t % 20 === 0) {
          const idle = raiders.filter((id) => game.units.get(id)?.orders.length === 0);
          const prey = workers.filter((id) => game.units.has(id));
          if (idle.length && prey.length)
            game.enqueue({
              player: 0,
              tick: game.tick,
              cmd: { type: 'attackMove', units: idle, to: center(game, prey) },
            });
        }
      }
      const killed = workers.filter((id) => !game.units.has(id)).length * value('worker');
      return killed / (n * value(type));
    };
    const scout = raid('scout_rider');
    const knight = raid('knight');
    if (process.env.BALANCE_LOG) console.log('raid worker value killed per resource', { scout, knight });
    expect(scout).toBeGreaterThan(knight);
  });

  it('Scout Rider: a chasing Militia or Knight never catches a retreating Scout Rider', () => {
    for (const chaser of ['militia', 'knight'] as const) {
      const game = createGame(openMap(60, 20), { seed: 3 });
      const s = game.debugSpawn(1, 'scout_rider', 8, 10);
      const c = game.debugSpawn(0, chaser, 5.5, 10);
      game.enqueue({ player: 1, tick: 0, cmd: { type: 'move', units: [s], to: { x: 58, y: 10 } } });
      game.enqueue({ player: 0, tick: 0, cmd: { type: 'interact', units: [c], target: s } });
      for (let t = 0; t < 15 * 20; t++) game.step();
      expect(game.units.get(s)!.hp, chaser).toBe(U.scout_rider!.hp);
    }
  });

  it('Knight: razing a House under Town Hall and tower fire, Knights lose the least value per damage dealt', () => {
    const raze = (type: ArmyUnit): number => {
      const game = createGame(openMap(40, 30), { seed: 3 });
      game.debugBuilding(1, 'town_hall', 20, 10);
      game.debugBuilding(1, 'watch_tower', 24, 15);
      const house = game.debugBuilding(1, 'house', 21, 14);
      const n = Math.max(1, Math.round(600 / value(type)));
      const army = Array.from({ length: n }, (_, i) =>
        game.debugSpawn(0, type, 21 + (i % 4) * 0.7, 22 + Math.floor(i / 4) * 0.7),
      );
      game.enqueue({ player: 0, tick: 0, cmd: { type: 'interact', units: army, target: house } });
      const maxHp = GAME_DATA.buildings.house!.hp;
      for (let t = 0; t < 30 * 20 && game.buildings.has(house); t++) game.step();
      const dealt = maxHp - (game.buildings.get(house)?.hp ?? 0);
      const lost = n * value(type) - valueLeft(game, army);
      return lost / Math.max(1, dealt);
    };
    const knight = raze('knight');
    if (process.env.BALANCE_LOG)
      console.log('raze value lost per building damage', {
        knight,
        militia: raze('militia'),
        archer: raze('archer'),
        scout_rider: raze('scout_rider'),
      });
    for (const other of ['militia', 'archer', 'scout_rider'] as const)
      expect(knight, other).toBeLessThan(raze(other));
  });
});

// keep the UnitTypeId import meaningful for type checks of ARMY
const _check: readonly UnitTypeId[] = ARMY;
void _check;
