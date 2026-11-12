/** "Anyone can win against Easy": a novice's simple plan beats it (slow headless match, own file). */
import { describe, expect, it } from 'vitest';
import { match, type Match } from './sim';

function center(r: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function townHall(m: Match, owner: number): { x: number; y: number; w: number; h: number } {
  const th = [...m.game.buildings.values()].find((b) => b.owner === owner && b.type === 'town_hall');
  if (!th) throw new Error('no Town Hall');
  return th;
}

function soldiers(m: Match, owner: number): number[] {
  return [...m.game.units.values()].filter((u) => u.owner === owner && u.type !== 'worker').map((u) => u.id);
}

describe('Easy can be beaten by anyone', () => {
  // TODO(balance): known failure since units stopped pushing through each other (2026-11-11): the
  // single Militia wave dies with Easy's Town Hall still standing. Retune Easy, then make this `it`.
  it.fails(
    'a novice beats it: train Militia, stay home, attack once at 12:00 (scenario start)',
    () => {
      const m = match({ scenario: true, ai: [1], mode: 'easy', seed: 1 });
      for (let minute = 0; minute < 20 && !m.game.result; minute++) {
        const barracks = [...m.game.buildings.values()].find((b) => b.owner === 0 && b.type === 'barracks');
        if (barracks)
          for (let k = 0; k < 5; k++)
            m.game.enqueue({
              player: 0,
              tick: m.game.tick,
              cmd: { type: 'train', building: barracks.id, unit: 'militia' },
            });
        if (minute === 12)
          m.game.enqueue({
            player: 0,
            tick: m.game.tick,
            cmd: { type: 'attackMove', units: soldiers(m, 0), to: center(townHall(m, 1)) },
          });
        m.run(60);
      }
      expect(m.game.result?.winner).toBe(0);
    },
    60000,
  );
});
