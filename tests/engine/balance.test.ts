/**
 * Army balance (docs/units.md). The seven rules for the field units, as tests (the Catapult, a siege
 * unit, has its own section at the end: its matchups are buildings, not armies):
 *   1. a clear role and 3. a situation where it has the advantage: one situation test per unit;
 *   2. an exploitable weakness: the matrix losses and the building-damage check;
 *   4. no unit is best everywhere: no unit and no army mix wins every equal-cost fight;
 *   5. every unit has at least two counters (and counters at least two units);
 *   6. the game still works without gold: the gold-free units counter each other in a closed
 *      cycle, every unit has a gold-free counter, and a gold-free army can be built and can win;
 *   7. every army of two unit types beats at least one other two-type army and is beaten by at
 *      least one (the two armies may share one unit type).
 * Army sizes come from the costs in units.json, so retuning the data keeps the tests meaningful.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createGame, GAME_DATA, type Game } from '../../src/engine';
import type { EntityId, PlayerId, UnitTypeId } from '../../src/shared';
import { tableAfter } from '../docs/markdown';
import { node, openMap } from './helpers';

const U = GAME_DATA.units;
/** The field units, in the order of docs/units.md: foot soldiers, shooters, riders. */
const ARMY = ['militia', 'guard', 'slinger', 'archer', 'scout_rider', 'knight'] as const;
type ArmyUnit = (typeof ARMY)[number];

/** docs/units.md §1, the 3×2 grid: each group has one unit that needs no gold and one that does. */
const GRID: Record<string, { cheap: ArmyUnit; gold: ArmyUnit }> = {
  'foot soldiers': { cheap: 'militia', gold: 'guard' },
  shooters: { cheap: 'slinger', gold: 'archer' },
  riders: { cheap: 'scout_rider', gold: 'knight' },
};
const needsGold = (type: string): boolean => (U[type]!.cost.gold ?? 0) > 0;
const GOLD_FREE = ARMY.filter((u) => !needsGold(u));

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
  militia: ['guard', 'scout_rider', 'knight'],
  guard: ['archer', 'scout_rider', 'knight'],
  slinger: ['militia', 'guard'],
  archer: ['militia', 'slinger'],
  scout_rider: ['slinger', 'archer'],
  knight: ['slinger', 'archer', 'scout_rider'],
};
/** The units that beat `unit` at equal cost: its counters. */
const countersOf = (unit: ArmyUnit): ArmyUnit[] => ARMY.filter((other) => BEATS[other].includes(unit));

const DOC = readFileSync(new URL('../../docs/units.md', import.meta.url), 'utf8');
const names = (units: readonly ArmyUnit[]): string => units.map((u) => U[u]!.name).join(', ');

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

  it('every pair has exactly one winner', () => {
    for (const a of ARMY)
      for (const b of ARMY)
        if (a !== b) expect(BEATS[a].includes(b), `${a} vs ${b}`).toBe(!BEATS[b].includes(a));
  });

  it('docs/units.md §1 shows the same matrix', () => {
    const rows = tableAfter(DOC, '### 1.2 Who beats whom');
    expect(rows.map((r) => r[0])).toEqual(ARMY.map((u) => `**${U[u]!.name}**`));
    for (const [i, a] of ARMY.entries())
      for (const [j, b] of ARMY.entries()) {
        const cell = rows[i]![j + 1];
        expect(cell, `${a} vs ${b}`).toBe(a === b ? '—' : BEATS[a].includes(b) ? 'wins' : 'loses');
      }
  });

  it('the in-game descriptions name the same matchups (Strong vs … / Weak vs …)', () => {
    for (const unit of ARMY) {
      const text = U[unit]!.description;
      const strong = /Strong vs ([^.;]*)/.exec(text)?.[1] ?? '';
      const weak = /Weak vs ([^.;]*)/.exec(text)?.[1] ?? '';
      for (const other of ARMY) {
        if (other === unit) continue;
        const name = U[other]!.name;
        expect(strong.includes(name), `${unit}: "Strong vs" names ${name}`).toBe(BEATS[unit].includes(other));
        expect(weak.includes(name), `${unit}: "Weak vs" names ${name}`).toBe(BEATS[other].includes(unit));
      }
    }
  });
});

describe('the 3×2 grid (docs/units.md §1.1)', () => {
  it('holds every field unit once: one gold-free and one gold unit per group', () => {
    const all = Object.values(GRID).flatMap((g) => [g.cheap, g.gold]);
    expect([...all].sort()).toEqual([...ARMY].sort());
    for (const [group, g] of Object.entries(GRID)) {
      expect(needsGold(g.cheap), `${group}: ${g.cheap}`).toBe(false);
      expect(needsGold(g.gold), `${group}: ${g.gold}`).toBe(true);
    }
  });

  it('shooters shoot, foot soldiers and riders fight hand to hand, riders are the fastest', () => {
    for (const u of [GRID.shooters!.cheap, GRID.shooters!.gold])
      expect(U[u]!.attack!.range, u).toBeGreaterThan(0);
    for (const group of ['foot soldiers', 'riders'])
      for (const u of [GRID[group]!.cheap, GRID[group]!.gold]) expect(U[u]!.attack!.range, u).toBe(0);
    const riders = [GRID.riders!.cheap, GRID.riders!.gold];
    for (const u of ARMY)
      if (!riders.includes(u))
        for (const r of riders) expect(U[r]!.speed, `${r} vs ${u}`).toBeGreaterThan(U[u]!.speed);
  });

  it('the gold unit of a group is the stronger body: more HP than its gold-free partner', () => {
    for (const g of Object.values(GRID)) expect(U[g.gold]!.hp, g.gold).toBeGreaterThan(U[g.cheap]!.hp);
  });

  it('docs/units.md §1.1 shows the same grid', () => {
    const rows = tableAfter(DOC, '### 1.1 The grid');
    expect(rows.map((r) => r.slice(1))).toEqual([
      Object.values(GRID).map((g) => U[g.cheap]!.name),
      Object.values(GRID).map((g) => U[g.gold]!.name),
    ]);
  });
});

describe('rule 5: every unit has at least two counters (docs/units.md §1.3)', () => {
  it('every unit loses to at least two units and beats at least two', () => {
    for (const unit of ARMY) {
      expect(countersOf(unit).length, `counters of ${unit}`).toBeGreaterThanOrEqual(2);
      expect(BEATS[unit].length, `${unit} beats`).toBeGreaterThanOrEqual(2);
    }
  });

  it('docs/units.md §1.3 lists the same counters, with the same counts', () => {
    const rows = tableAfter(DOC, '### 1.3 Counter table');
    expect(rows.map((r) => r[0])).toEqual(ARMY.map((u) => `**${U[u]!.name}**`));
    for (const [i, unit] of ARMY.entries()) {
      const [, beats, beatsN, counters, countersN, goldFree] = rows[i]!;
      expect(beats, `${unit} beats`).toBe(names(BEATS[unit]));
      expect(beatsN, `${unit} beats (count)`).toBe(String(BEATS[unit].length));
      expect(counters, `counters of ${unit}`).toBe(names(countersOf(unit)));
      expect(countersN, `counters of ${unit} (count)`).toBe(String(countersOf(unit).length));
      expect(goldFree, `gold-free counters of ${unit}`).toBe(
        names(countersOf(unit).filter((c) => !needsGold(c))),
      );
    }
  });
});

describe('rule 6: the game still works without gold (docs/units.md §1.4)', () => {
  it('the gold-free units counter each other in a closed cycle: each beats one and loses to one', () => {
    expect(GOLD_FREE.length).toBe(3);
    for (const unit of GOLD_FREE) {
      expect(
        BEATS[unit].filter((o) => !needsGold(o)),
        `${unit} beats`,
      ).toHaveLength(1);
      expect(
        countersOf(unit).filter((o) => !needsGold(o)),
        `counters of ${unit}`,
      ).toHaveLength(1);
    }
  });

  it('every unit, gold or not, has a counter that needs no gold', () => {
    for (const unit of ARMY)
      expect(countersOf(unit).filter((c) => !needsGold(c)).length, unit).toBeGreaterThanOrEqual(1);
  });

  it('a town without gold can still house, feed and train: those buildings and units cost no gold', () => {
    const B = GAME_DATA.buildings;
    const noGold = (cost: Partial<Record<string, number>>): boolean => (cost.gold ?? 0) === 0;
    // room and food
    const houses = Object.values(B).filter((b) => b.popProvided > 0 && b.actions.length === 0);
    expect(houses.some((b) => noGold(b.cost))).toBe(true);
    const farms = Object.values(B).filter((b) => b.gather?.resource === 'food');
    expect(farms.some((b) => noGold(b.cost))).toBe(true);
    // workers, and every gold-free field unit from a building that costs no gold
    for (const unit of ['worker', ...GOLD_FREE]) {
      expect(noGold(U[unit]!.cost), unit).toBe(true);
      const trainers = Object.entries(B).filter(([, b]) =>
        b.actions.some((a) => a.type === 'train' && a.unit === unit),
      );
      const placeable = trainers.filter(([id]) => GAME_DATA.game.buildMenu.some((e) => e.building === id));
      // (the Town Hall costs gold, but you start with one: losing it loses the game anyway)
      if (unit !== 'worker')
        expect(
          placeable.some(([, b]) => noGold(b.cost)),
          `${unit} trained at a gold-free building`,
        ).toBe(true);
    }
  });

  it('a gold-free unit hurts buildings and towers, so a gold-free army can end the game', () => {
    const min = GAME_DATA.game.combat.minDamage;
    for (const type of ['town_hall', 'watch_tower']) {
      const b = GAME_DATA.buildings[type]!;
      const best = Math.max(
        ...GOLD_FREE.map((u) => {
          const a = U[u]!.attack!;
          return a.damage + (a.bonus[b.class] ?? 0) - b.armor;
        }),
      );
      expect(best, type).toBeGreaterThan(min);
    }
  });

  it('800 resources of Militia raze a Town Hall guarded by a Watch Tower', () => {
    const game = createGame(openMap(50, 40), { seed: 3 });
    game.debugBuilding(1, 'watch_tower', 26, 13);
    const hall = game.debugBuilding(1, 'town_hall', 20, 10);
    const n = Math.round(800 / value('militia'));
    const army = Array.from({ length: n }, (_, i) =>
      game.debugSpawn(0, 'militia', 20 + (i % 5) * 0.7, 30 + Math.floor(i / 5) * 0.7),
    );
    game.enqueue({ player: 0, tick: 0, cmd: { type: 'interact', units: army, target: hall } });
    let t = 0;
    for (; t < 240 * 20 && game.buildings.has(hall); t++) game.step();
    if (process.env.BALANCE_LOG)
      console.log('militia vs town hall', {
        seconds: t / 20,
        left: valueLeft(game, army) / (n * value('militia')),
      });
    expect(game.buildings.has(hall)).toBe(false);
    expect(valueLeft(game, army)).toBeGreaterThan(0.5 * n * value('militia'));
  });

  /** Every army of gold-free units only: singles, pairs and all three. */
  const GOLD_FREE_ARMIES: Record<string, Army> = {
    militia: [['militia', 1]],
    slinger: [['slinger', 1]],
    scout_rider: [['scout_rider', 1]],
    'militia+slinger': [
      ['militia', 0.5],
      ['slinger', 0.5],
    ],
    'militia+scout_rider': [
      ['militia', 0.5],
      ['scout_rider', 0.5],
    ],
    'slinger+scout_rider': [
      ['slinger', 0.5],
      ['scout_rider', 0.5],
    ],
    'all three': [
      ['militia', 1 / 3],
      ['slinger', 1 / 3],
      ['scout_rider', 1 / 3],
    ],
  };
  /** One gold-free answer to each gold-free army: without gold, no army is the best everywhere. */
  const GOLD_FREE_ANSWER: Record<string, string> = {
    militia: 'militia+slinger',
    slinger: 'scout_rider',
    scout_rider: 'militia',
    'militia+slinger': 'slinger',
    'militia+scout_rider': 'militia',
    'slinger+scout_rider': 'militia',
    'all three': 'militia+slinger',
  };
  for (const [name, army] of Object.entries(GOLD_FREE_ARMIES)) {
    it(`without gold: ${name} is beaten by ${GOLD_FREE_ANSWER[name]}`, () => {
      const r = fight(GOLD_FREE_ARMIES[GOLD_FREE_ANSWER[name]!]!, army, 800);
      if (process.env.BALANCE_LOG) console.log('gold-free', GOLD_FREE_ANSWER[name], 'vs', name, r);
      expect(r.winner).toBe('a');
    });
  }

  it('a gold army is not safe from a gold-free one: Militia beat the Guard + Archer + Knight mix', () => {
    const gold: Army = [
      ['guard', 1 / 3],
      ['archer', 1 / 3],
      ['knight', 1 / 3],
    ];
    expect(fight([['militia', 1]], gold, 800).winner).toBe('a');
    expect(fight(gold, [['militia', 1]], 800).winner).toBe('b');
  });
});

describe('army mixes (docs/units.md §3)', () => {
  const half = (a: ArmyUnit, b: ArmyUnit): Army => [
    [a, 0.5],
    [b, 0.5],
  ];
  const MIXES: Record<string, Army> = {
    militia: [['militia', 1]],
    guard: [['guard', 1]],
    slinger: [['slinger', 1]],
    archer: [['archer', 1]],
    scout_rider: [['scout_rider', 1]],
    knight: [['knight', 1]],
    'militia+guard': half('militia', 'guard'),
    'militia+slinger': half('militia', 'slinger'),
    'militia+archer': half('militia', 'archer'),
    'militia+knight': half('militia', 'knight'),
    'guard+slinger': half('guard', 'slinger'),
    'guard+archer': half('guard', 'archer'),
    'guard+knight': half('guard', 'knight'),
    'archer+knight': half('archer', 'knight'),
    'the three gold-free units': GOLD_FREE.map((u) => [u, 1 / 3]),
    'the three gold units': ARMY.filter(needsGold).map((u) => [u, 1 / 3]),
    'all six': ARMY.map((u) => [u, 1 / 6]),
  };
  /** One equal-cost answer to each mix: no army is the best choice everywhere. */
  const ANSWER: Record<string, string> = {
    militia: 'militia+slinger',
    guard: 'militia+slinger',
    slinger: 'scout_rider',
    archer: 'guard',
    scout_rider: 'militia',
    knight: 'militia',
    'militia+guard': 'slinger',
    'militia+slinger': 'archer',
    'militia+archer': 'guard+archer',
    'militia+knight': 'militia',
    'guard+slinger': 'knight',
    'guard+archer': 'knight',
    'guard+knight': 'militia',
    'archer+knight': 'guard',
    'the three gold-free units': 'knight',
    'the three gold units': 'guard',
    'all six': 'militia',
  };
  for (const [name, army] of Object.entries(MIXES)) {
    it(`${name} is beaten by ${ANSWER[name]}`, () => {
      const r = fight(MIXES[ANSWER[name]!]!, army, 800);
      if (process.env.BALANCE_LOG) console.log('mix', ANSWER[name], 'vs', name, r);
      expect(r.winner).toBe('a');
    });
  }

  it('docs/units.md §3 lists the same answers', () => {
    const label = (id: string): string =>
      id.includes('+')
        ? id
            .split('+')
            .map((u) => U[u]!.name)
            .join(' + ')
        : (U[id]?.name ?? id.charAt(0).toUpperCase() + id.slice(1));
    const rows = tableAfter(DOC, '## 3. Why no unit is the best choice everywhere');
    expect(rows).toEqual(Object.keys(MIXES).map((id) => [label(id), label(ANSWER[id]!)]));
  });
});

describe('rule 7: every pair of unit types beats a pair and is beaten by a pair (docs/units.md §3.1)', () => {
  /** The letters of docs/units.md §3.1. */
  const SHORT: Record<ArmyUnit, string> = {
    militia: 'M',
    guard: 'G',
    slinger: 'S',
    archer: 'A',
    scout_rider: 'R',
    knight: 'K',
  };
  type Pair = readonly [ArmyUnit, ArmyUnit];
  /** All 15 armies of two different unit types, half of the budget each. */
  const PAIRS: Pair[] = ARMY.flatMap((a, i) => ARMY.slice(i + 1).map((b): Pair => [a, b]));
  const pairName = ([a, b]: Pair): string => `${SHORT[a]}+${SHORT[b]}`;
  const armyOf = ([a, b]: Pair): Army => [
    [a, 0.5],
    [b, 0.5],
  ];
  // every fight is needed by two tests (one for each side), so it runs once
  const cache = new Map<string, FightResult>();
  const result = (p: Pair, q: Pair, budget: number): FightResult => {
    const key = `${pairName(p)} ${pairName(q)} ${budget}`;
    let r = cache.get(key);
    if (!r) cache.set(key, (r = fight(armyOf(p), armyOf(q), budget)));
    return r;
  };
  /**
   * `p` clearly beats `q`: it wins from either side of the field (the sides start at different
   * spots), and keeps more than 25% of its value both times, as in §1.
   */
  const clearlyBeats = (p: Pair, q: Pair, budget: number): boolean => {
    const asA = result(p, q, budget);
    const asB = result(q, p, budget);
    return asA.winner === 'a' && asA.left > 0.25 && asB.winner === 'b' && asB.left > 0.25;
  };
  const beatsOf = (p: Pair, budget: number): Pair[] =>
    PAIRS.filter((q) => q !== p && clearlyBeats(p, q, budget));
  const beatenBy = (p: Pair, budget: number): Pair[] =>
    PAIRS.filter((q) => q !== p && clearlyBeats(q, p, budget));

  it('covers every pair of different unit types once, sharing one type allowed', () => {
    expect(PAIRS).toHaveLength((ARMY.length * (ARMY.length - 1)) / 2);
    const shared = (p: Pair, q: Pair): number => p.filter((u) => q.includes(u)).length;
    expect(PAIRS.some((p) => PAIRS.some((q) => shared(p, q) === 1))).toBe(true);
    for (const p of PAIRS)
      expect(
        PAIRS.filter((q) => shared(p, q) === 2),
        pairName(p),
      ).toEqual([p]);
  });

  for (const budget of [400, 800])
    for (const p of PAIRS)
      it(`${budget} a side: ${pairName(p)} beats at least one pair and loses to at least one`, () => {
        const beats = beatsOf(p, budget);
        const by = beatenBy(p, budget);
        if (process.env.BALANCE_LOG)
          console.log(budget, pairName(p), 'beats', beats.map(pairName), 'beaten by', by.map(pairName));
        expect(beats.length, `${pairName(p)} beats`).toBeGreaterThanOrEqual(1);
        expect(by.length, `${pairName(p)} is beaten by`).toBeGreaterThanOrEqual(1);
      }, 30_000);

  it('docs/units.md §3.1 lists the same clear wins (800 a side)', () => {
    const expected = PAIRS.map((p) => {
      const beats = beatsOf(p, 800);
      const by = beatenBy(p, 800);
      return [
        `**${pairName(p)}**`,
        beats.map(pairName).join(', '),
        String(beats.length),
        by.map(pairName).join(', '),
        String(by.length),
      ];
    });
    if (process.env.BALANCE_LOG) console.log(expected.map((r) => `| ${r.join(' | ')} |`).join('\n'));
    expect(tableAfter(DOC, '### 3.1 Pairs of unit types')).toEqual(expected);
  }, 120_000);
});

describe('weaknesses (docs/units.md §2)', () => {
  const hit = (attacker: string, armor: number, cls: string): number => {
    const a = U[attacker]!.attack!;
    return Math.max(GAME_DATA.game.combat.minDamage, a.damage + (a.bonus[cls] ?? 0) - armor);
  };

  it('slingers, archers and scout riders barely hurt buildings and towers (minimum damage)', () => {
    for (const type of ['town_hall', 'house', 'watch_tower']) {
      const b = GAME_DATA.buildings[type]!;
      const cls = b.class ?? 'building';
      for (const unit of ['slinger', 'archer', 'scout_rider'])
        expect(hit(unit, b.armor, cls), `${unit} vs ${type}`).toBe(GAME_DATA.game.combat.minDamage);
      for (const unit of ['militia', 'guard', 'knight'])
        expect(hit(unit, b.armor, cls), `${unit} vs ${type}`).toBeGreaterThan(
          GAME_DATA.game.combat.minDamage,
        );
    }
  });

  it('foot soldiers are the slowest field units; the scout rider is the fastest unit of all', () => {
    const speeds = ARMY.map((t) => U[t]!.speed);
    expect(Math.min(...speeds)).toBe(U.militia!.speed);
    expect(U.guard!.speed).toBe(U.militia!.speed);
    for (const [type, def] of Object.entries(U))
      if (type !== 'scout_rider') expect(def.speed, type).toBeLessThan(U.scout_rider!.speed);
  });

  it('knights cost gold and two population; the gold-free units cost one', () => {
    expect(U.knight!.cost.gold ?? 0).toBeGreaterThan(0);
    expect(U.knight!.pop).toBe(2);
    for (const unit of GOLD_FREE) expect(U[unit]!.pop, unit).toBe(1);
  });

  it('Guard: an arrow does it less than half the damage it does to a Militia; a sling stone does not', () => {
    const on = (attacker: string, target: string): number =>
      hit(attacker, U[target]!.armor, U[target]!.class);
    expect(on('archer', 'guard')).toBeLessThan(on('archer', 'militia') / 2);
    expect(on('slinger', 'guard')).toBe(on('slinger', 'militia'));
    // and a tower's or Town Hall's arrows are no better against it than against a Militia
    expect(on('archer', 'guard')).toBeGreaterThan(GAME_DATA.game.combat.minDamage);
  });

  it('Slinger: outranged by the Archer and by every building that shoots; harmless to riders', () => {
    const range = U.slinger!.attack!.range;
    expect(range).toBeLessThan(U.archer!.attack!.range);
    for (const b of Object.values(GAME_DATA.buildings))
      if (b.attack) expect(range, b.name).toBeLessThan(b.attack.range);
    expect(hit('slinger', U.knight!.armor, U.knight!.class)).toBe(GAME_DATA.game.combat.minDamage);
    expect(hit('slinger', U.scout_rider!.armor, U.scout_rider!.class)).toBeLessThan(
      hit('slinger', U.militia!.armor, U.militia!.class) / 2,
    );
  });
});

describe('where each unit shines (docs/units.md §2)', () => {
  it('Militia: a Knight charge into an equal-cost Militia block loses', () => {
    const r = fight([['knight', 1]], [['militia', 1]], 600);
    expect(r.winner).toBe('b');
  });

  it('Guard: beats an Archer + Knight army of the same cost clearly, which Militia alone barely do', () => {
    const goldArmy: Army = [
      ['archer', 0.5],
      ['knight', 0.5],
    ];
    const guard = fight([['guard', 1]], goldArmy, 800);
    const militia = fight([['militia', 1]], goldArmy, 800);
    if (process.env.BALANCE_LOG) console.log('vs archer+knight', { guard, militia });
    expect(guard.winner).toBe('a');
    expect(guard.left).toBeGreaterThan(0.3);
    expect(guard.left).toBeGreaterThan(militia.winner === 'a' ? militia.left : 0);
  });

  it('Guard: walks through arrows that stop Militia: it reaches an Archer line with more of its HP', () => {
    const reach = (type: ArmyUnit): number => {
      const game = createGame(openMap(60, 20), { seed: 3 });
      const archers = [0, 1, 2, 3, 4, 5].map((i) => game.debugSpawn(1, 'archer', 40, 7 + i));
      game.enqueue({ player: 1, tick: 0, cmd: { type: 'setStance', units: archers, stance: 'hold' } });
      const n = Math.round(360 / value(type));
      const walkers = Array.from({ length: n }, (_, i) => game.debugSpawn(0, type, 28, 8 + i));
      game.enqueue({ player: 0, tick: 0, cmd: { type: 'attackMove', units: walkers, to: { x: 40, y: 10 } } });
      // until the first walker strikes an archer
      for (let t = 0; t < 20 * 20; t++) {
        game.step();
        if (archers.some((id) => (game.units.get(id)?.hp ?? 0) < U.archer!.hp)) break;
      }
      return valueLeft(game, walkers) / (n * value(type));
    };
    const guard = reach('guard');
    const militia = reach('militia');
    if (process.env.BALANCE_LOG) console.log('value left on reaching the archers', { guard, militia });
    expect(guard).toBeGreaterThan(militia + 0.1);
  });

  it('Slinger: without gold, Slingers behind a Militia line beat all-Militia and all-Guard armies', () => {
    const line: Army = [
      ['militia', 0.5],
      ['slinger', 0.5],
    ];
    for (const enemy of ['militia', 'guard'] as const) {
      const r = fight(line, [[enemy, 1]], 800);
      if (process.env.BALANCE_LOG) console.log('militia+slinger vs', enemy, r);
      expect(r.winner, enemy).toBe('a');
      expect(r.left, enemy).toBeGreaterThan(0.3);
    }
    expect(line.every(([u]) => !needsGold(u))).toBe(true);
  });

  it('Slinger: per resource, no unit kills foot soldiers faster than the Slinger', () => {
    const dps = (attacker: ArmyUnit, target: ArmyUnit): number => {
      const a = U[attacker]!.attack!;
      const t = U[target]!;
      const dmg = Math.max(GAME_DATA.game.combat.minDamage, a.damage + (a.bonus[t.class] ?? 0) - t.armor);
      return dmg / a.cooldown / value(attacker);
    };
    for (const target of ['militia', 'guard'] as const)
      for (const other of ARMY)
        if (other !== 'slinger')
          expect(dps('slinger', target), `${other} on ${target}`).toBeGreaterThan(dps(other, target));
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

  it('Scout Rider: a chasing Militia, Guard or Knight never catches a retreating Scout Rider', () => {
    for (const chaser of ['militia', 'guard', 'knight'] as const) {
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
    const others = ARMY.filter((u) => u !== 'knight');
    if (process.env.BALANCE_LOG)
      console.log('raze value lost per building damage', {
        knight,
        ...Object.fromEntries(others.map((u) => [u, raze(u)])),
      });
    for (const other of others) expect(knight, other).toBeLessThan(raze(other));
  });
});

// keep the UnitTypeId import meaningful for type checks of ARMY
const _check: readonly UnitTypeId[] = ARMY;
void _check;

describe('Catapult: siege (docs/units.md §6)', () => {
  /** Attack a target with `n` units of `type` standing `dist` tiles south of it; seconds until it falls. */
  const siege = (
    type: string,
    budget: number,
    defences: (game: Game) => EntityId,
  ): { seconds: number; lost: number; army: number } => {
    const game = createGame(openMap(50, 40), { seed: 3 });
    const target = defences(game);
    const n = Math.max(1, Math.round(budget / value(type)));
    const army = Array.from({ length: n }, (_, i) =>
      game.debugSpawn(0, type, 20 + (i % 4) * 0.8, 32 + Math.floor(i / 4) * 0.8),
    );
    game.enqueue({ player: 0, tick: 0, cmd: { type: 'interact', units: army, target } });
    let t = 0;
    for (; t < 240 * 20 && game.buildings.has(target); t++) {
      game.step();
      if (t % 20 === 0) {
        const idle = army.filter((id) => game.units.get(id)?.orders.length === 0);
        if (idle.length && game.buildings.has(target))
          game.enqueue({ player: 0, tick: game.tick, cmd: { type: 'interact', units: idle, target } });
      }
    }
    return {
      seconds: game.buildings.has(target) ? Infinity : t / 20,
      lost: n * value(type) - valueLeft(game, army),
      army: n * value(type),
    };
  };

  it('outranges the Watch Tower and the Town Hall', () => {
    const range = U.catapult!.attack!.range;
    for (const b of ['watch_tower', 'town_hall'])
      expect(range, b).toBeGreaterThan(GAME_DATA.buildings[b]!.attack!.range);
  });

  it('two Catapults destroy a Watch Tower from out of its range and both survive', () => {
    const r = siege('catapult', 2 * value('catapult'), (g) => g.debugBuilding(1, 'watch_tower', 21, 12));
    if (process.env.BALANCE_LOG) console.log('2 catapults vs tower', r);
    expect(r.seconds).toBeLessThan(60);
    expect(r.lost).toBe(0);
  });

  it('against a Town Hall guarded by a tower, Catapults lose far less value than the same cost of Knights', () => {
    const base = (g: Game): EntityId => {
      g.debugBuilding(1, 'watch_tower', 26, 13);
      return g.debugBuilding(1, 'town_hall', 20, 10);
    };
    const cat = siege('catapult', 1100, base);
    const knight = siege('knight', 1100, base);
    if (process.env.BALANCE_LOG) console.log('town hall siege', { cat, knight });
    expect(cat.seconds).toBeLessThan(Infinity);
    expect(cat.lost / cat.army).toBeLessThan(knight.lost / knight.army);
  });

  it('one stone hurts every Militia of a clump standing still (splash)', () => {
    const game = createGame(openMap(40, 30), { seed: 3 });
    const c = game.debugSpawn(0, 'catapult', 10, 15);
    const clump = [0, 1, 2, 3].map((i) =>
      game.debugSpawn(1, 'militia', 16.6 + (i % 2) * 0.55, 14.7 + Math.floor(i / 2) * 0.55),
    );
    game.enqueue({ player: 0, tick: 0, cmd: { type: 'interact', units: [c], target: clump[0]! } });
    game.enqueue({ player: 1, tick: 0, cmd: { type: 'setStance', units: clump, stance: 'hold' } });
    for (let t = 0; t < 3 * 20; t++) game.step();
    const hurt = clump.filter((id) => (game.units.get(id)?.hp ?? 0) < U.militia!.hp);
    expect(hurt.length).toBeGreaterThanOrEqual(3);
  });

  it('weak: it loses the equal-cost field battle against every unit that can hurt it, and cavalry crushes it', () => {
    // The one exception is the Slinger: a sling stone does minimum damage to the machine, and
    // Slingers stand still in a clump inside its splash (docs/units.md §6).
    const min = GAME_DATA.game.combat.minDamage;
    const hurts = (u: ArmyUnit): boolean => {
      const a = U[u]!.attack!;
      return a.damage + (a.bonus[U.catapult!.class] ?? 0) - U.catapult!.armor > min;
    };
    expect(ARMY.filter((u) => !hurts(u))).toEqual(['slinger']);
    for (const other of ARMY) {
      const r = fight([['catapult' as ArmyUnit, 1]], [[other, 1]], 810);
      if (process.env.BALANCE_LOG) console.log('catapult vs', other, r);
      if (!hurts(other)) continue;
      expect(r.winner, other).toBe('b');
      if (other === 'scout_rider' || other === 'knight') expect(r.left, other).toBeGreaterThan(0.75);
    }
  });

  it('weak: one Scout Rider kills a lone Catapult (it cannot shoot within its minimum range)', () => {
    const game = createGame(openMap(40, 30), { seed: 3 });
    const c = game.debugSpawn(0, 'catapult', 10, 15);
    const s = game.debugSpawn(1, 'scout_rider', 25, 15);
    game.enqueue({ player: 1, tick: 0, cmd: { type: 'interact', units: [s], target: c } });
    for (let t = 0; t < 30 * 20 && game.units.has(c); t++) game.step();
    expect(game.units.has(c)).toBe(false);
    expect(game.units.has(s)).toBe(true);
  });

  it('weak: the slowest unit, and the most expensive', () => {
    for (const [type, def] of Object.entries(U)) {
      if (type === 'catapult') continue;
      expect(def.speed, type).toBeGreaterThan(U.catapult!.speed);
      expect(value(type), type).toBeLessThan(value('catapult'));
    }
  });
});
