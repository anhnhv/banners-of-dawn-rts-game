import { describe, expect, it } from 'vitest';
import buildings from '../../src/data/buildings.json';
import game from '../../src/data/game.json';
import projectiles from '../../src/data/projectiles.json';
import resources from '../../src/data/resources.json';
import units from '../../src/data/units.json';
import { type GameDataError, parseGameData, type RawGameData } from '../../src/shared';

const raw = (): RawGameData =>
  structuredClone({
    units: units.units,
    buildings: buildings.buildings,
    nodes: resources.nodes,
    resources: resources.types,
    projectiles: projectiles.projectiles,
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
      expect(issues).toContain(
        'gathers "unicorn_tree", which is neither a node kind nor a building with gather',
      );
    }
  });

  it('checks gather buildings (Farm): a gather target may be one; the panel field needs gather', () => {
    const ok = parseGameData(raw());
    expect(ok.buildings.farm?.gather).toMatchObject({ resource: 'food', slots: 1 });
    expect(ok.units.worker?.interactions.gather?.targets.farm).toBeGreaterThan(0);

    const r = raw() as unknown as {
      buildings: Record<string, { gather?: unknown; panel: string[] }>;
    };
    delete r.buildings.farm!.gather; // the worker's "farm" target is no longer a gather building
    r.buildings.house!.panel.push('gatherers');
    try {
      parseGameData(r as unknown as RawGameData);
      expect.unreachable();
    } catch (e) {
      const issues = (e as GameDataError).issues.join('\n');
      expect(issues).toContain('gathers "farm", which is neither a node kind nor a building with gather');
      expect(issues).toContain('buildings.house: panel field "gatherers" needs gather');
      expect(issues).toContain('buildings.farm: panel field "gatherers" needs gather');
    }
  });

  it("checks a unit's own target priority classes", () => {
    const r = raw() as unknown as {
      units: Record<string, { combat: { targetPriority?: Record<string, number> } }>;
    };
    r.units.catapult!.combat.targetPriority = { dragon: 1 };
    expect(() => parseGameData(r as unknown as RawGameData)).toThrow(
      /units\.catapult\.combat\.targetPriority: unknown class "dragon"/,
    );
  });

  it('reports bad field values', () => {
    const r = raw() as { units: Record<string, { speed: number }> };
    r.units.worker!.speed = -1;
    expect(() => parseGameData(r as unknown as RawGameData)).toThrow(/units\.worker\.speed/);
  });

  it('checks combat config: bonus classes, projectiles, priorities, ranged attacks', () => {
    const r = raw() as unknown as {
      units: Record<string, { attack: Record<string, unknown> }>;
      buildings: Record<string, { attack?: Record<string, unknown> }>;
      game: { combat: { targetPriority: Record<string, number> } };
    };
    r.units.militia!.attack.bonus = { dragons: 5 };
    r.units.archer!.attack.projectile = 'laser';
    r.buildings.house!.attack = { damage: 1, range: 4, cooldown: 1 };
    r.game.combat.targetPriority['ghost'] = 9;
    try {
      parseGameData(r as unknown as RawGameData);
      expect.unreachable();
    } catch (e) {
      const issues = (e as GameDataError).issues.join('\n');
      expect(issues).toContain('units.militia.attack.bonus: unknown class "dragons"');
      expect(issues).toContain('units.archer.attack: unknown projectile "laser"');
      expect(issues).toContain('buildings.house.attack: a ranged attack needs a projectile');
      expect(issues).toContain('targetPriority: unknown class "ghost"');
    }
  });

  it('gives units sensible combat defaults', () => {
    const data = parseGameData(raw());
    expect(data.units.worker?.combat).toMatchObject({ autoAttack: false, fleeWhenHit: 4 });
    expect(data.units.militia?.combat).toMatchObject({
      autoAttack: true,
      stance: 'aggressive',
      fleeWhenHit: 0,
    });
    expect(data.buildings.house?.class).toBe('building');
    expect(data.buildings.watch_tower?.attack?.targets).toEqual(['unit']);
  });
});
