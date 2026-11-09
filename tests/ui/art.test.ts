/**
 * No placeholder art (docs/plans/m7-menus-art-maps.md §5): every icon and model named in the game
 * data exists, and no two entities share an icon.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { GAME_DATA } from '../../src/engine';
import { ART_COLLECTIONS, DEFAULT_ART_ID, art, setArtCollection } from '../../src/ui/art/collections';
import { classic } from '../../src/ui/art/collections/classic';
import {
  buildingGeometry,
  buildingModel,
  constructionCoreGeometry,
  constructionSiteGeometry,
  projectileGeometry,
  rockBlockGeometry,
  rockGeometry,
  rubbleGeometry,
  treeGeometry,
  unitModel,
  unitParts,
  wallGeometry,
  type BuildingModel,
  type TreeModel,
  type UnitModel,
} from '../../src/ui/art/models';
import { TEAMS } from '../../src/ui/art/palette';
import type { BuiltGeometry } from '../../src/ui/art/VoxelBuilder';
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

describe('art collections', () => {
  const models = (): number => {
    let boxes = 0;
    const count = (g: BuiltGeometry): void => {
      boxes += g.geometry.getAttribute('position').count;
    };
    for (const t of TEAMS) {
      for (const m of Object.keys(classic.buildings) as BuildingModel[]) count(buildingGeometry(m, t));
      for (const m of Object.keys(classic.units) as UnitModel[]) {
        const p = unitParts(m, t);
        [p.body, ...p.legs.map((l) => l.geometry), ...p.arms.map((a) => a.geometry)].forEach(count);
      }
    }
    for (const m of Object.keys(classic.trees) as TreeModel[]) count(treeGeometry(m));
    for (const v of [0, 1, 2] as const) count(rockBlockGeometry(v));
    [rockGeometry(), wallGeometry('x'), rubbleGeometry(3, 3), projectileGeometry('stone')].forEach(count);
    count(constructionSiteGeometry(3, 3, 1.1));
    count(constructionCoreGeometry(2, 2));
    return boxes;
  };

  afterEach(() => setArtCollection('classic'));

  it('ids are unique and classic comes first', () => {
    const ids = ART_COLLECTIONS.map((c) => c.id);
    expect(ids[0]).toBe('classic');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(ART_COLLECTIONS.map((c) => c.id))('%s draws every model with known colors', (id) => {
    expect(setArtCollection(id)).toBe(id);
    expect(models()).toBeGreaterThan(0);
  });

  it('a collection only overrides what it defines; the rest comes from classic', () => {
    setArtCollection('autumn');
    expect(art().colors.leaf).not.toBe(classic.colors.leaf);
    expect(art().colors.stone).toBe(classic.colors.stone);
    expect(art().trees.oak).toBe(classic.trees.oak);
    expect(art().trees.oakTall).not.toBe(classic.trees.oakTall);
    expect(art().icons).toBe(classic.icons);
  });

  it('missing and unknown ids fall back to the default collection', () => {
    expect(setArtCollection('nope')).toBe(DEFAULT_ART_ID);
    expect(setArtCollection(null)).toBe(DEFAULT_ART_ID);
    expect(DEFAULT_ART_ID).toBe('aetherfall');
  });
});
