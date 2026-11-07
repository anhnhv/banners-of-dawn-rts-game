/**
 * Map file format (PLAN §8.1). Maps are JSON files in the top-level `maps/` folder.
 * Terrain and objects are stored as character grids so maps can be read, edited by hand and diffed.
 */
import { z } from 'zod';

export const TERRAIN_TYPES = ['grass', 'dirt', 'sand', 'shallow', 'water', 'rock'] as const;
export type TerrainType = (typeof TERRAIN_TYPES)[number];

/** Object names a map legend may use. `spawn_p1` is the human player, `spawn_p2` the machine player. */
export const MAP_OBJECT_NAMES = [
  'tree',
  'pine',
  'gold_mine',
  'berry_bush',
  'stone',
  'spawn_p1',
  'spawn_p2',
] as const;
export type MapObjectName = (typeof MAP_OBJECT_NAMES)[number];

const gridRows = z.array(z.string()).min(1);
const legendChar = z.string().length(1);
const tile = z.tuple([z.number().int(), z.number().int()]);

/**
 * Optional ready-made start (PLAN §8.1): extra buildings, units and resources per player, so a
 * match can begin mid-game (used as the default setup while testing). When it is used it replaces
 * `start.units`; the Town Halls at the spawns always stay. Coordinates are tiles (x, y).
 */
export const MapScenarioSchema = z.object({
  name: z.string().default('Scenario'),
  description: z.string().default(''),
  players: z
    .array(
      z.object({
        /** 1 = spawn_p1 (human), 2 = spawn_p2 (machine). */
        player: z.union([z.literal(1), z.literal(2)]),
        /** Replaces game.json → startingResources for the listed resources. */
        resources: z.record(z.string(), z.number().int().min(0)).default({}),
        buildings: z
          .array(
            z.object({
              type: z.string(),
              /** Top-left tile of the footprint. */
              at: tile,
              /** false = an unfinished construction site. */
              constructed: z.boolean().default(true),
            }),
          )
          .default([]),
        units: z
          .array(
            z.object({
              type: z.string(),
              /** The group stands in formation around this tile (nearest free tiles). */
              at: tile,
              count: z.number().int().positive().default(1),
              /** Start gathering this resource (food, wood, gold) at the nearest nodes. */
              gather: z.string().optional(),
              stance: z.enum(['aggressive', 'hold']).optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});
export type MapScenario = z.infer<typeof MapScenarioSchema>;

export const MapFileSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/, 'id must be lower_snake_case'),
  name: z.string().min(1),
  description: z.string().default(''),
  version: z.number().int().positive(),
  size: z.object({ w: z.number().int().min(16).max(256), h: z.number().int().min(16).max(256) }),
  players: z.literal(2),
  symmetry: z.enum(['rotate180', 'none']),
  legend: z.object({
    terrain: z.record(legendChar, z.enum(TERRAIN_TYPES)),
    objects: z.record(legendChar, z.enum(MAP_OBJECT_NAMES)),
  }),
  terrain: gridRows,
  objects: gridRows,
  overrides: z
    .array(
      z.object({ at: z.tuple([z.number().int(), z.number().int()]), amount: z.number().int().positive() }),
    )
    .default([]),
  start: z
    .object({ units: z.array(z.tuple([z.string(), z.number().int().positive()])) })
    .default({ units: [] }),
  scenario: MapScenarioSchema.optional(),
});

export type MapFile = z.infer<typeof MapFileSchema>;
export type MapFileInput = z.input<typeof MapFileSchema>;

export const MapIndexSchema = z.object({
  maps: z.array(z.object({ id: z.string(), file: z.string(), recommended: z.boolean().optional() })),
});
export type MapIndex = z.infer<typeof MapIndexSchema>;
