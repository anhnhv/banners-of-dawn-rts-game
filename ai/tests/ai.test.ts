/** The machine player in real headless matches (inline controller, deterministic). */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/engine';
import { InlineAIController } from '../../src/host/aiController';
import { PROFILES } from '../../src/ai';
import { decodeMap, TICK_RATE, type Observation } from '../../src/shared';
import { GREEN_VALLEY, match, type Match } from './sim';

const count = (m: Match, owner: number, type: string): number =>
  [...m.game.units.values(), ...m.game.buildings.values()].filter((e) => e.owner === owner && e.type === type)
    .length;

function center(r: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function townHall(m: Match, owner: number): { x: number; y: number; w: number; h: number } {
  const th = [...m.game.buildings.values()].find((b) => b.owner === owner && b.type === 'town_hall');
  if (!th) throw new Error('no Town Hall');
  return th;
}

describe('both modes', () => {
  it.each(['easy', 'normal'] as const)('%s only sends workers to safe nodes on its own half', (mode) => {
    const m = match({ scenario: false, ai: [1], mode });
    const home = center(townHall(m, 1));
    const enemy = center(townHall(m, 0));
    for (let i = 0; i < 8; i++) {
      m.run(60);
      const obs: Observation = m.game.observe(1);
      for (const u of obs.units) {
        if (u.owner !== 1 || u.order.kind !== 'gather') continue;
        const order = u.order;
        const node = obs.nodes.find((n) => n.id === order.node);
        if (!node) continue;
        const c = center(node);
        expect(Math.hypot(c.x - home.x, c.y - home.y)).toBeLessThanOrEqual(
          Math.hypot(c.x - enemy.x, c.y - enemy.y),
        );
      }
    }
  });

  it.each(['easy', 'normal'] as const)('%s beats an idle opponent from the standard start', (mode) => {
    const m = match({ scenario: false, ai: [1], mode });
    m.run(15 * 60);
    expect(m.game.result?.winner).toBe(1);
  });

  it.each(['easy', 'normal'] as const)('%s is deterministic', (mode) => {
    const a = match({ scenario: false, ai: [1], mode });
    const b = match({ scenario: false, ai: [1], mode });
    a.run(3 * 60);
    b.run(3 * 60);
    expect(a.game.stateHash()).toBe(b.game.stateHash());
  });
});

describe('Normal: a careful player', () => {
  it('builds an economy from the standard start: workers, houses, a barracks, all workers busy', () => {
    const m = match({ scenario: false, ai: [1], mode: 'normal' });
    m.run(4 * 60);
    expect(count(m, 1, 'worker')).toBeGreaterThanOrEqual(12);
    expect(count(m, 1, 'house')).toBeGreaterThanOrEqual(2);
    expect(count(m, 1, 'barracks')).toBeGreaterThanOrEqual(1);
    const obs = m.game.observe(1);
    const idle = obs.units.filter((u) => u.owner === 1 && u.type === 'worker' && u.order.kind === 'idle');
    expect(idle.length).toBeLessThanOrEqual(1);
    expect(obs.pop).toBeLessThanOrEqual(obs.popCap);
  });

  it('builds a Stable after its Barracks and trains cavalry too (standard start)', () => {
    const m = match({ scenario: false, ai: [1], mode: 'normal' });
    m.run(10 * 60);
    expect(count(m, 1, 'barracks')).toBeGreaterThanOrEqual(1);
    expect(count(m, 1, 'stable')).toBeGreaterThanOrEqual(1);
    const t = m.trained.get(1) ?? {};
    expect((t.scout_rider ?? 0) + (t.knight ?? 0)).toBeGreaterThan(0);
  });

  it('answers what it sees: against an all-Knight army it trains mostly Militia (counter pick)', () => {
    const m = match({ scenario: false, ai: [1], mode: 'normal' });
    const th = townHall(m, 0);
    for (let i = 0; i < 6; i++)
      m.game.debugSpawn(0, 'knight', th.x - 2 - (i % 3), th.y + 4 + Math.floor(i / 3));
    m.run(10 * 60);
    const t = m.trained.get(1) ?? {};
    const army = Object.entries(t).filter(([type]) => type !== 'worker');
    const total = army.reduce((n, [, c]) => n + c, 0);
    expect(total).toBeGreaterThan(4);
    expect((t.militia ?? 0) / total).toBeGreaterThan(0.5);
  });

  it('against an all-Militia army it trains Archers and leaves its Stable idle (no horses into spears)', () => {
    const m = match({ scenario: false, ai: [1], mode: 'normal' });
    const th = townHall(m, 0);
    for (let i = 0; i < 12; i++)
      m.game.debugSpawn(0, 'militia', th.x - 2 - (i % 4), th.y + 4 + Math.floor(i / 4));
    m.run(10 * 60);
    const t = m.trained.get(1) ?? {};
    expect(count(m, 1, 'stable')).toBeGreaterThanOrEqual(1);
    expect(t.archer ?? 0).toBeGreaterThan(3);
    expect((t.scout_rider ?? 0) + (t.knight ?? 0)).toBe(0);
  });

  it('beats an idle opponent from the scenario start (decides to attack once it cannot grow)', () => {
    const m = match({ scenario: true, ai: [1], mode: 'normal' });
    m.run(15 * 60);
    expect(m.game.result?.winner).toBe(1);
  });

  it('defends its base when attacked', () => {
    const game = createGame(decodeMap(GREEN_VALLEY), { seed: 2, testArmy: 14 });
    const ai = new InlineAIController(game, 1, PROFILES.normal);
    const step = (seconds: number, each?: () => void): void => {
      for (let i = 0; i < seconds * TICK_RATE && !game.result; i++) {
        ai.afterStep(game.step());
        if (i % TICK_RATE === 0) each?.();
      }
    };
    step(5 * 60);
    const aiTh = [...game.buildings.values()].find((b) => b.owner === 1 && b.type === 'town_hall');
    if (!aiTh) throw new Error('AI Town Hall missing');
    const raiders = [...game.units.values()]
      .filter((u) => u.owner === 0 && u.type !== 'worker')
      .map((u) => u.id);
    game.enqueue({
      player: 0,
      tick: game.tick,
      cmd: { type: 'attackMove', units: raiders, to: center(aiTh) },
    });
    let defended = false;
    step(90, () => {
      if (ai.status().includes('defend')) defended = true;
    });
    expect(defended).toBe(true);
    expect(raiders.filter((id) => game.units.has(id)).length).toBeLessThan(raiders.length);
  });

  it('beats Easy', () => {
    const m = match({ scenario: false, ai: [0, 1], mode: { 0: 'normal', 1: 'easy' }, seed: 1 });
    m.run(20 * 60);
    expect(m.game.result?.winner).toBe(0);
  });
});

describe('Easy: a relaxed opponent', () => {
  const easy = PROFILES.easy;

  it('keeps a small economy: few workers, one Barracks, no tower, no Stable, only Militia', () => {
    const m = match({ scenario: false, ai: [1], mode: 'easy' });
    m.run(8 * 60);
    expect(count(m, 1, 'worker')).toBeLessThanOrEqual(easy.economy.workerTarget);
    expect(count(m, 1, 'barracks')).toBeLessThanOrEqual(easy.buildings.maxProducersPerType);
    expect(count(m, 1, 'watch_tower')).toBe(0);
    expect(count(m, 1, 'stable')).toBe(0); // one kind of army building: the Barracks
    expect(Object.keys(m.trained.get(1) ?? {}).filter((t) => t !== 'worker')).toEqual(['militia']); // the first button
  });

  it(`attacks with at most ${easy.attack.groupSize} soldiers at a time, never before ${easy.attack.earliestAttackSeconds / 60}:00`, () => {
    const m = match({ scenario: true, ai: [1], mode: 'easy' });
    const enemy = townHall(m, 0);
    let most = 0;
    let firstTick = -1;
    for (let s = 0; s < 9 * 60 && !m.game.result; s += 5) {
      m.run(5);
      // soldiers well inside the enemy half are on an attack
      const away = [...m.game.units.values()].filter(
        (u) =>
          u.owner === 1 &&
          u.type !== 'worker' &&
          Math.hypot(u.x - (enemy.x + 1.5), u.y - (enemy.y + 1.5)) < 22,
      ).length;
      if (away > 0 && firstTick < 0) firstTick = m.game.tick;
      most = Math.max(most, away);
    }
    expect(firstTick).toBeGreaterThanOrEqual(easy.attack.earliestAttackSeconds * TICK_RATE);
    expect(most).toBeLessThanOrEqual(easy.attack.groupSize + 1);
  });
});
