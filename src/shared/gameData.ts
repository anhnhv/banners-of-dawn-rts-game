/**
 * Game data schema (PLAN §9): units, buildings, resource nodes, resource types and global rules,
 * all from JSON in src/data. Everything an entity can do — what it gathers, what it trains, what
 * its info panel shows, which buttons it has — comes from here, not from code.
 *
 * parseGameData() validates the shape AND the cross-references (a train action must name a real
 * unit, a gather target must be a real node kind, …) and throws listing every problem.
 */
import { z } from 'zod';

export const RESOURCE_TYPES = ['food', 'wood', 'gold'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type ResourceAmounts = Record<ResourceType, number>;

/** Info fields an entity's selection panel can show (rendered generically by the UI). */
export const PANEL_FIELDS = [
  'hp',
  'armor',
  'speed',
  'sight',
  'gatherRate',
  'task',
  'pop',
  'queue',
  'amount',
  'construction',
] as const;
export type PanelField = (typeof PANEL_FIELDS)[number];

const hotkey = z.string().regex(/^[A-Z]$/, 'hotkey must be one capital letter');
const cost = z.partialRecord(z.enum(RESOURCE_TYPES), z.number().int().min(0));

export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('train'), unit: z.string(), hotkey }),
  z.object({ type: z.literal('stop'), hotkey }),
  z.object({ type: z.literal('setRally'), hotkey }),
]);
export type ActionDef = z.infer<typeof ActionSchema>;

const common = {
  name: z.string(),
  description: z.string().default(''),
  model: z.string(),
  icon: z.string(),
  panel: z.array(z.enum(PANEL_FIELDS)).default([]),
  actions: z.array(ActionSchema).default([]),
};

export const UnitDefSchema = z.object({
  ...common,
  class: z.string(),
  era: z.number().int().min(1).max(3),
  cost,
  trainTime: z.number().positive(),
  pop: z.number().int().min(0),
  hp: z.number().positive(),
  armor: z.number().min(0),
  speed: z.number().positive(),
  sight: z.number().positive(),
  radius: z.number().positive().max(0.5),
  attack: z.object({
    damage: z.number().min(0),
    range: z.number().min(0),
    minRange: z.number().min(0).optional(),
    cooldown: z.number().positive(),
  }),
  interactions: z
    .object({
      /** Node kinds this unit can harvest, with the rate (resource per second) for each. */
      gather: z.object({ targets: z.record(z.string(), z.number().positive()) }).optional(),
    })
    .default({}),
});
export type UnitDef = z.infer<typeof UnitDefSchema>;

export const BuildingDefSchema = z.object({
  ...common,
  footprint: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  hp: z.number().positive(),
  armor: z.number().min(0),
  popProvided: z.number().int().min(0),
  cost,
  buildTime: z.number().positive(),
});
export type BuildingDef = z.infer<typeof BuildingDefSchema>;

export const NodeDefSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  resource: z.enum(RESOURCE_TYPES),
  amount: z.number().int().positive(),
  model: z.string(),
  icon: z.string(),
  panel: z.array(z.enum(PANEL_FIELDS)).default([]),
});
export type NodeDef = z.infer<typeof NodeDefSchema>;

export const GameConfigSchema = z.object({
  startingResources: z.record(z.enum(RESOURCE_TYPES), z.number().int().min(0)),
  popCap: z.number().int().positive(),
  pace: z.object({
    gatherRate: z.number().positive(),
    trainSpeed: z.number().positive(),
    buildSpeed: z.number().positive(),
  }),
  production: z.object({ queueMax: z.number().int().positive() }),
  /** Buildings the player can place from the Build button (no workers needed). */
  buildMenu: z.array(z.object({ building: z.string(), hotkey })),
  construction: z.object({ startHpFraction: z.number().min(0.01).max(1) }),
  gathering: z.object({ retargetRadius: z.number().positive(), reach: z.number().positive() }),
});
export type GameConfig = z.infer<typeof GameConfigSchema>;

export interface GameData {
  units: Record<string, UnitDef>;
  buildings: Record<string, BuildingDef>;
  nodes: Record<string, NodeDef>;
  resources: Record<ResourceType, { name: string; icon: string }>;
  game: GameConfig;
}

export interface RawGameData {
  units: unknown;
  buildings: unknown;
  nodes: unknown;
  resources: unknown;
  game: unknown;
}

export class GameDataError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid game data:\n  - ${issues.join('\n  - ')}`);
    this.name = 'GameDataError';
  }
}

/** Validate and type the raw JSON. Throws GameDataError with every problem found. */
export function parseGameData(raw: RawGameData): GameData {
  const issues: string[] = [];
  const parse = <T>(schema: z.ZodType<T>, value: unknown, where: string): T | null => {
    const r = schema.safeParse(value);
    if (r.success) return r.data;
    for (const i of r.error.issues) issues.push(`${where}.${i.path.join('.')}: ${i.message}`);
    return null;
  };
  const units = parse(z.record(z.string(), UnitDefSchema), raw.units, 'units');
  const buildings = parse(z.record(z.string(), BuildingDefSchema), raw.buildings, 'buildings');
  const nodes = parse(z.record(z.string(), NodeDefSchema), raw.nodes, 'nodes');
  const resources = parse(
    z.record(z.enum(RESOURCE_TYPES), z.object({ name: z.string(), icon: z.string() })),
    raw.resources,
    'resources',
  );
  const game = parse(GameConfigSchema, raw.game, 'game');
  if (!units || !buildings || !nodes || !resources || !game) throw new GameDataError(issues);

  // cross-references
  const checkActions = (owner: string, actions: ActionDef[]): void => {
    for (const a of actions) {
      if (a.type === 'train' && !units[a.unit]) issues.push(`${owner}: trains unknown unit "${a.unit}"`);
    }
    const keys = actions.map((a) => a.hotkey);
    const dup = keys.find((k, i) => keys.indexOf(k) !== i);
    if (dup) issues.push(`${owner}: hotkey "${dup}" is used twice`);
  };
  for (const [id, u] of Object.entries(units)) {
    checkActions(`units.${id}`, u.actions);
    for (const target of Object.keys(u.interactions.gather?.targets ?? {})) {
      if (!nodes[target]) issues.push(`units.${id}: gathers unknown node kind "${target}"`);
    }
  }
  for (const [id, b] of Object.entries(buildings)) checkActions(`buildings.${id}`, b.actions);
  for (const entry of game.buildMenu) {
    if (!buildings[entry.building]) issues.push(`game.buildMenu: unknown building "${entry.building}"`);
  }
  const menuKeys = game.buildMenu.map((e) => e.hotkey);
  const menuDup = menuKeys.find((k, i) => menuKeys.indexOf(k) !== i);
  if (menuDup) issues.push(`game.buildMenu: hotkey "${menuDup}" is used twice`);
  if (issues.length > 0) throw new GameDataError(issues);

  return { units, buildings, nodes, resources, game };
}

/** Cost as a list for display, skipping zero entries. */
export function costEntries(c: Partial<Record<ResourceType, number>>): Array<[ResourceType, number]> {
  return RESOURCE_TYPES.filter((r) => (c[r] ?? 0) > 0).map((r) => [r, c[r] ?? 0]);
}
