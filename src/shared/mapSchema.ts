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
});

export type MapFile = z.infer<typeof MapFileSchema>;
export type MapFileInput = z.input<typeof MapFileSchema>;

export const MapIndexSchema = z.object({
  maps: z.array(z.object({ id: z.string(), file: z.string(), recommended: z.boolean().optional() })),
});
export type MapIndex = z.infer<typeof MapIndexSchema>;
