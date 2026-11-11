/**
 * The game still works without gold (docs/units.md §1.4, rule 6), checked with whole matches: the
 * gold mines are taken off the map and nobody starts with gold. Slow headless matches, so they
 * have their own file. The unit-level half of the rule is in tests/engine/balance.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../../src/engine';
import { defaultRules, type DecodedMap, type PlayerId } from '../../src/shared';
import { match, type Match } from './sim';

const U = GAME_DATA.units;
const needsGold = (type: string): boolean => (U[type]?.cost.gold ?? 0) > 0;
/** The field units that cost no gold (not the worker, not siege). */
const GOLD_FREE = Object.keys(U).filter((t) => t !== 'worker' && !needsGold(t));

const withoutGoldMines = (map: DecodedMap): DecodedMap => ({
  ...map,
  objects: map.objects.filter((o) => o.kind !== 'gold_mine'),
});
const rules = {
  ...defaultRules(GAME_DATA.game),
  startingResources: { ...GAME_DATA.game.startingResources, gold: 0 },
};
const soldiers = (m: Match, p: PlayerId): Record<string, number> =>
  Object.fromEntries(Object.entries(m.trained.get(p) ?? {}).filter(([type]) => type !== 'worker'));

describe('no gold on the map and none to start with (standard start)', () => {
  it('the map really has no gold', () => {
    const m = match({ scenario: false, ai: [], edit: withoutGoldMines, rules });
    expect([...m.game.nodes.values()].filter((n) => n.resource === 'gold')).toHaveLength(0);
    for (const p of [0, 1] as const) expect(m.game.player(p).resources.gold).toBe(0);
    expect(GOLD_FREE.sort()).toEqual(['militia', 'scout_rider', 'slinger']);
  });

  it('Normal still builds a town and an army, and beats an idle opponent', () => {
    const m = match({ scenario: false, ai: [1], mode: 'normal', edit: withoutGoldMines, rules });
    m.run(15 * 60);
    expect(m.game.result?.winner).toBe(1);
    const trained = soldiers(m, 1);
    expect(Object.keys(trained).length).toBeGreaterThan(0);
    for (const type of Object.keys(trained)) expect(needsGold(type), type).toBe(false);
  }, 120_000);

  it('Normal vs Normal: both train all three gold-free units, and no unit takes over the army', () => {
    const m = match({ scenario: false, ai: [0, 1], mode: 'normal', edit: withoutGoldMines, rules });
    m.run(16 * 60);
    for (const p of [0, 1] as const) {
      const trained = soldiers(m, p);
      const total = Object.values(trained).reduce((a, b) => a + b, 0);
      expect(total, `player ${p} soldiers`).toBeGreaterThan(30);
      for (const type of Object.keys(trained)) expect(needsGold(type), `player ${p} ${type}`).toBe(false);
      for (const type of GOLD_FREE) {
        expect(trained[type] ?? 0, `player ${p} ${type}`).toBeGreaterThan(0);
        expect((trained[type] ?? 0) / total, `player ${p} share of ${type}`).toBeLessThan(0.7);
      }
    }
  }, 180_000);
});
