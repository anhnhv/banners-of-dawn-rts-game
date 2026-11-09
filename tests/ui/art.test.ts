/**
 * No placeholder art (docs/plans/m7-menus-art-maps.md §5): every icon and model named in the game
 * data exists, and no two entities share an icon.
 */
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../../src/engine';
import { buildingModel, unitModel } from '../../src/ui/art/models';
import { iconFor } from '../../src/ui/hud/pixelIcons';

const entities = [
  ...Object.entries(GAME_DATA.units).map(([id, d]) => ({ id, icon: d.icon })),
  ...Object.entries(GAME_DATA.buildings).map(([id, d]) => ({ id, icon: d.icon })),
  ...Object.entries(GAME_DATA.nodes).map(([id, d]) => ({ id, icon: d.icon })),
];

describe('art for every entity', () => {
  it('every icon named in the data exists (no fallback)', () => {
    for (const e of entities) expect(iconFor(e.icon), e.id).toBe(e.icon);
  });

  it('no two units, buildings or resource nodes share an icon', () => {
    const owners = new Map<string, string[]>();
    for (const e of entities) owners.set(e.icon, [...(owners.get(e.icon) ?? []), e.id]);
    expect([...owners.values()].filter((ids) => ids.length > 1)).toEqual([]);
  });

  it('every unit and building model exists (no fallback to another model)', () => {
    for (const [id, d] of Object.entries(GAME_DATA.units)) expect(unitModel(d.model), id).toBe(d.model);
    for (const [id, d] of Object.entries(GAME_DATA.buildings))
      expect(buildingModel(d.model), id).toBe(d.model);
  });
});
