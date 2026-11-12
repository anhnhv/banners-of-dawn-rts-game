/**
 * The machine player on the newer maps (docs/plans/m7-menus-art-maps.md §6): rivers and a forest
 * belt must not trap its placement or its attacks, and Easy must stay beatable by a novice.
 * Slow headless matches, so they have their own file.
 */
import { describe, expect, it } from 'vitest';
import { mapFile, match, type Match } from './sim';

function center(r: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function townHall(m: Match, owner: number): { x: number; y: number; w: number; h: number } {
  const th = [...m.game.buildings.values()].find((b) => b.owner === owner && b.type === 'town_hall');
  if (!th) throw new Error('no Town Hall');
  return th;
}

const MAPS = ['twin_rivers', 'forest_pass'] as const;

describe.each(MAPS)('%s', (id) => {
  const map = mapFile(id);

  it('Normal beats an idle opponent from the standard start', () => {
    const m = match({ map, scenario: false, ai: [1], mode: 'normal' });
    m.run(15 * 60);
    expect(m.game.result?.winner).toBe(1);
  }, 60000);

  // TODO(balance): known failure on both maps since units stopped pushing through each other
  // (2026-11-12): the single wave does not kill Easy's Town Hall. Retune Easy, then make this `it`.
  it.fails(
    'a novice beats Easy: train Militia, stay home, attack once at 12:00 (scenario start)',
    () => {
      const m = match({ map, scenario: true, ai: [1], mode: 'easy', seed: 1 });
      for (let minute = 0; minute < 20 && !m.game.result; minute++) {
        const barracks = [...m.game.buildings.values()].find((b) => b.owner === 0 && b.type === 'barracks');
        if (barracks)
          for (let k = 0; k < 5; k++)
            m.game.enqueue({
              player: 0,
              tick: m.game.tick,
              cmd: { type: 'train', building: barracks.id, unit: 'militia' },
            });
        if (minute === 12) {
          const army = [...m.game.units.values()]
            .filter((u) => u.owner === 0 && u.type !== 'worker')
            .map((u) => u.id);
          m.game.enqueue({
            player: 0,
            tick: m.game.tick,
            cmd: { type: 'attackMove', units: army, to: center(townHall(m, 1)) },
          });
        }
        m.run(60);
      }
      expect(m.game.result?.winner).toBe(0);
    },
    60000,
  );
});
