/** docs/units.md must match the game data (§4 damage table, §5 stats table; all five army units). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../../src/engine';
import { tableAfter } from './markdown';

const DOC = readFileSync(new URL('../../docs/units.md', import.meta.url), 'utf8');
const U = GAME_DATA.units;
const ARMY = ['militia', 'archer', 'scout_rider', 'knight', 'catapult'];

const name = (type: string): string => U[type]!.name;
const fmt = (n: number): string => String(n);

describe('docs/units.md matches units.json', () => {
  it('§4 damage per hit follows the engine formula', () => {
    const targets: Array<{ armor: number; cls: string }> = [
      ...ARMY.map((t) => ({ armor: U[t]!.armor, cls: U[t]!.class })),
      { armor: U.worker!.armor, cls: U.worker!.class },
      { armor: GAME_DATA.buildings.house!.armor, cls: 'building' },
    ];
    const rows = tableAfter(DOC, '## 4. Damage per hit');
    expect(rows.map((r) => r[0])).toEqual(ARMY.map((t) => `**${name(t)}**`));
    for (const [i, type] of ARMY.entries()) {
      const a = U[type]!.attack!;
      const expected = targets.map(({ armor, cls }) =>
        fmt(Math.max(GAME_DATA.game.combat.minDamage, a.damage + (a.bonus[cls] ?? 0) - armor)),
      );
      expect(rows[i]!.slice(1), name(type)).toEqual(expected);
    }
    // towers take the same damage as buildings, as the doc says
    const tower = GAME_DATA.buildings.watch_tower!;
    for (const type of ARMY) {
      const a = U[type]!.attack!;
      expect(a.bonus[tower.class ?? 'building'] ?? 0, type).toBe(a.bonus.building ?? 0);
      expect(tower.armor).toBe(GAME_DATA.buildings.house!.armor);
    }
  });

  it('§5 stats are the values in units.json and buildings.json', () => {
    const trainedAt = (type: string): string =>
      Object.values(GAME_DATA.buildings)
        .filter((b) => b.actions.some((a) => a.type === 'train' && a.unit === type))
        .map((b) => b.name)
        .join(', ');
    const cost = (type: string): string =>
      (['food', 'wood', 'gold'] as const)
        .filter((r) => (U[type]!.cost[r] ?? 0) > 0)
        .map((r) => `${U[type]!.cost[r]} ${r}`)
        .join(', ');
    const attack = (type: string): string => {
      const a = U[type]!.attack!;
      return `${a.damage}, ${a.range > 0 ? `range ${a.range}` : 'melee'}, every ${a.cooldown} s`;
    };
    const bonus = (type: string): string => {
      const entries = Object.entries(U[type]!.attack!.bonus);
      if (entries.length === 0) return '—';
      return entries.map(([cls, v]) => `${v >= 0 ? '+' : '−'}${Math.abs(v)} vs ${cls}`).join(', ');
    };
    const expected: Record<string, (type: string) => string> = {
      'Trained at': trainedAt,
      Cost: cost,
      'Train time': (t) => `${U[t]!.trainTime} s`,
      Population: (t) => fmt(U[t]!.pop),
      HP: (t) => fmt(U[t]!.hp),
      Armor: (t) => fmt(U[t]!.armor),
      'Speed (tiles/s)': (t) => fmt(U[t]!.speed),
      Sight: (t) => fmt(U[t]!.sight),
      Attack: attack,
      'Bonus damage': bonus,
    };
    const rows = tableAfter(DOC, '## 5. Stats');
    expect(rows.map((r) => r[0])).toEqual(Object.keys(expected));
    for (const row of rows) {
      const make = expected[row[0]!]!;
      expect(row.slice(1), row[0]).toEqual(ARMY.map(make));
    }
  });
});
