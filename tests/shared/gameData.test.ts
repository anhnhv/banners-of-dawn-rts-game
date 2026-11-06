import { describe, expect, it } from 'vitest';
import buildings from '../../src/data/buildings.json';
import game from '../../src/data/game.json';
import resources from '../../src/data/resources.json';
import units from '../../src/data/units.json';
import { type GameDataError, parseGameData, type RawGameData } from '../../src/shared';

const raw = (): RawGameData =>
  structuredClone({
    units: units.units,
    buildings: buildings.buildings,
    nodes: resources.nodes,
    resources: resources.types,
    game,
  });

describe('game data', () => {
  it('the shipped data is valid', () => {
    const data = parseGameData(raw());
    expect(data.buildings.town_hall?.actions.some((a) => a.type === 'train' && a.unit === 'worker')).toBe(
      true,
    );
    expect(Object.keys(data.units.worker?.interactions.gather?.targets ?? {})).toEqual(
      expect.arrayContaining(['tree', 'berry_bush', 'gold_mine']),
    );
  });

  it('reports broken cross-references and duplicate hotkeys', () => {
    const r = raw() as {
      units: Record<string, { interactions: { gather?: { targets: Record<string, number> } } }>;
      buildings: Record<string, { actions: unknown[] }>;
    };
    r.buildings.town_hall!.actions.push({ type: 'train', unit: 'dragon', hotkey: 'E' });
    r.buildings.town_hall!.actions.push({ type: 'stop', hotkey: 'Q' });
    r.units.worker!.interactions.gather!.targets['unicorn_tree'] = 1;
    try {
      parseGameData(r as unknown as RawGameData);
      expect.unreachable();
    } catch (e) {
      const issues = (e as GameDataError).issues.join('\n');
      expect(issues).toContain('trains unknown unit "dragon"');
      expect(issues).toContain('hotkey "Q" is used twice');
      expect(issues).toContain('gathers unknown node kind "unicorn_tree"');
    }
  });

  it('reports bad field values', () => {
    const r = raw() as { units: Record<string, { speed: number }> };
    r.units.worker!.speed = -1;
    expect(() => parseGameData(r as unknown as RawGameData)).toThrow(/units\.worker\.speed/);
  });
});
