/**
 * Game data schema (PLAN §9): units, buildings, resource nodes, resource types and global rules,
 * all from JSON in src/data. Everything an entity can do — what it gathers, what it trains, what
 * its info panel shows, which buttons it has — comes from here, not from code.
 *
 * parseGameData() validates the shape AND the cross-references (a train action must name a real
 * unit, a gather target must be a real node kind or gather building, …) and throws listing every problem.
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
  'attack',
  'stance',
  /** Workers in the building's gather slots, e.g. "Farmer 1/1" (buildings with `gather`). */
  'gatherers',
] as const;
export type PanelField = (typeof PANEL_FIELDS)[number];

const hotkey = z.string().regex(/^[A-Z]$/, 'hotkey must be one capital letter');
const cost = z.partialRecord(z.enum(RESOURCE_TYPES), z.number().int().min(0));

export const STANCES = ['aggressive', 'hold'] as const;
export type Stance = (typeof STANCES)[number];

/** What an attacker may hit: enemy units and/or enemy buildings. */
export const ATTACK_TARGETS = ['unit', 'building'] as const;

export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('train'), unit: z.string(), hotkey }),
  z.object({ type: z.literal('stop'), hotkey }),
  z.object({ type: z.literal('setRally'), hotkey }),
  z.object({ type: z.literal('attackMove'), hotkey }),
  z.object({ type: z.literal('stance'), stance: z.enum(STANCES), hotkey }),
]);
export type ActionDef = z.infer<typeof ActionSchema>;

/**
 * An attack, for units and buildings alike (PLAN §9.5). range 0 = melee. Ranged attacks fly the
 * named projectile; damage = max(minDamage, damage + bonus[target class] - target armor).
 */
export const AttackSchema = z.object({
  damage: z.number().min(0),
  range: z.number().min(0),
  minRange: z.number().min(0).optional(),
  cooldown: z.number().positive(),
  /** What it may pick by itself (auto-acquire, towers). */
  targets: z.array(z.enum(ATTACK_TARGETS)).min(1).default(['unit', 'building']),
  /** Extra damage by target class (unit `class` or building `class`). */
  bonus: z.record(z.string(), z.number()).default({}),
  /** projectiles.json key; omitted = the hit lands at once. */
  projectile: z.string().optional(),
  /** Height the projectile starts from (default: the projectile's launchHeight). */
  launchHeight: z.number().min(0).optional(),
  /** Area damage around the impact point, `edge` = damage fraction at the rim. */
  splash: z.object({ radius: z.number().positive(), edge: z.number().min(0).max(1) }).optional(),
});
export type AttackDef = z.infer<typeof AttackSchema>;

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
  cost,
  trainTime: z.number().positive(),
  pop: z.number().int().min(0),
  hp: z.number().positive(),
  armor: z.number().min(0),
  speed: z.number().positive(),
  sight: z.number().positive(),
  radius: z.number().positive().max(0.5),
  /** Drawn size of the model (1 = as drawn). Looks only: radius, sight and range are unchanged. */
  modelScale: z.number().positive().default(1),
  attack: AttackSchema.optional(),
  /** How the unit behaves around enemies. */
  combat: z
    .object({
      /** Picks targets by itself (idle, aggressive stance, attack-move). */
      autoAttack: z.boolean().default(true),
      /** Starting stance. */
      stance: z.enum(STANCES).default('aggressive'),
      /** Tiles to run away when hit while idle (0 = stand). */
      fleeWhenHit: z.number().min(0).default(0),
      /** Own target priority by class (lower = first); replaces game.json → combat.targetPriority. */
      targetPriority: z.record(z.string(), z.number()).optional(),
    })
    .prefault({}),
  interactions: z
    .object({
      /**
       * What this unit can harvest, with the rate (resource per second) for each: resource node
       * kinds, and building types that have `gather` (e.g. a Farm).
       */
      gather: z.object({ targets: z.record(z.string(), z.number().positive()) }).optional(),
      /** Right-click on an enemy entity of these kinds attacks it (needs `attack`). */
      attack: z.object({ targets: z.array(z.enum(ATTACK_TARGETS)).min(1) }).optional(),
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
  /** Class for damage bonuses and target priority. */
  class: z.string().default('building'),
  sight: z.number().positive().default(6),
  /** Finished buildings with an attack shoot enemies in range by themselves. */
  attack: AttackSchema.optional(),
  /**
   * The finished building is a resource source its owner's workers can gather (e.g. a Farm): it
   * never runs out, and at most `slots` workers gather at a time. Rates are on the unit
   * (units.json → interactions.gather.targets[building type]).
   */
  gather: z
    .object({
      resource: z.enum(RESOURCE_TYPES),
      slots: z.number().int().positive(),
      /**
       * Tiles the worker steps INTO the footprint to work (e.g. a farmer on the field). The
       * building still blocks everyone else; 0 = it works from the edge, like at a node.
       */
      workInside: z.number().min(0).max(0.9).default(0),
    })
    .optional(),
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

export const ProjectileDefSchema = z.object({
  /** Tiles per second. */
  speed: z.number().positive(),
  /** Peak height of the flight as a fraction of its length. */
  arc: z.number().min(0),
  /** Homing projectiles follow the target and always hit; others land where the target was. */
  homing: z.boolean(),
  model: z.string(),
  launchHeight: z.number().min(0).default(0.5),
});
export type ProjectileDef = z.infer<typeof ProjectileDefSchema>;

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
  combat: z.object({
    minDamage: z.number().min(0),
    /** Edge-to-edge distance at which a melee (range 0) attack connects. */
    meleeReach: z.number().positive(),
    acquireEveryTicks: z.number().int().positive(),
    /** An auto-acquired chase gives up this far from where it started. */
    leash: z.number().positive(),
    /** Priority of the enemy that is hitting me (lower = first). */
    attackerPriority: z.number(),
    /** Priority by target class (lower = first). */
    targetPriority: z.record(z.string(), z.number()),
    defaultPriority: z.number(),
    /** An idle unit hit within this many seconds goes for its attacker. */
    retaliateSeconds: z.number().min(0),
    underAttackAlertSeconds: z.number().min(0),
  }),
  effects: z.object({ corpseSeconds: z.number().min(0), rubbleSeconds: z.number().min(0) }),
  /** A player who owns none of these building types any more (sites count) is defeated. */
  victory: z
    .object({ defeatWhenLost: z.array(z.string()).min(1) })
    .prefault({ defeatWhenLost: ['town_hall'] }),
});
export type GameConfig = z.infer<typeof GameConfigSchema>;

export interface GameData {
  units: Record<string, UnitDef>;
  buildings: Record<string, BuildingDef>;
  nodes: Record<string, NodeDef>;
  resources: Record<ResourceType, { name: string; icon: string }>;
  projectiles: Record<string, ProjectileDef>;
  game: GameConfig;
}

export interface RawGameData {
  units: unknown;
  buildings: unknown;
  nodes: unknown;
  resources: unknown;
  projectiles: unknown;
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
  const projectiles = parse(z.record(z.string(), ProjectileDefSchema), raw.projectiles, 'projectiles');
  const game = parse(GameConfigSchema, raw.game, 'game');
  if (!units || !buildings || !nodes || !resources || !projectiles || !game) throw new GameDataError(issues);

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
      if (!nodes[target] && !buildings[target]?.gather)
        issues.push(
          `units.${id}: gathers "${target}", which is neither a node kind nor a building with gather`,
        );
    }
  }
  for (const [id, b] of Object.entries(buildings)) {
    checkActions(`buildings.${id}`, b.actions);
    if (b.panel.includes('gatherers') && !b.gather)
      issues.push(`buildings.${id}: panel field "gatherers" needs gather`);
    if (nodes[id] && b.gather) issues.push(`buildings.${id}: the id is also a node kind`);
  }

  // combat: classes named by bonuses and priorities must exist; projectiles must exist
  const classes = new Set([
    ...Object.values(units).map((u) => u.class),
    ...Object.values(buildings).map((b) => b.class),
  ]);
  const checkAttack = (owner: string, a: AttackDef | undefined): void => {
    if (!a) return;
    for (const c of Object.keys(a.bonus))
      if (!classes.has(c)) issues.push(`${owner}.attack.bonus: unknown class "${c}"`);
    if (a.projectile && !projectiles[a.projectile])
      issues.push(`${owner}.attack: unknown projectile "${a.projectile}"`);
    if (a.range > 0 && !a.projectile) issues.push(`${owner}.attack: a ranged attack needs a projectile`);
  };
  for (const [id, u] of Object.entries(units)) {
    checkAttack(`units.${id}`, u.attack);
    if (u.interactions.attack && !u.attack) issues.push(`units.${id}: interactions.attack needs an attack`);
    const usesAttack = u.actions.some((a) => a.type === 'attackMove' || a.type === 'stance');
    if (usesAttack && !u.attack) issues.push(`units.${id}: attackMove/stance actions need an attack`);
    for (const c of Object.keys(u.combat.targetPriority ?? {}))
      if (!classes.has(c)) issues.push(`units.${id}.combat.targetPriority: unknown class "${c}"`);
  }
  for (const [id, b] of Object.entries(buildings)) checkAttack(`buildings.${id}`, b.attack);
  for (const c of Object.keys(game.combat.targetPriority))
    if (!classes.has(c)) issues.push(`game.combat.targetPriority: unknown class "${c}"`);
  for (const entry of game.buildMenu) {
    if (!buildings[entry.building]) issues.push(`game.buildMenu: unknown building "${entry.building}"`);
  }
  for (const b of game.victory.defeatWhenLost)
    if (!buildings[b]) issues.push(`game.victory.defeatWhenLost: unknown building "${b}"`);
  const menuKeys = game.buildMenu.map((e) => e.hotkey);
  const menuDup = menuKeys.find((k, i) => menuKeys.indexOf(k) !== i);
  if (menuDup) issues.push(`game.buildMenu: hotkey "${menuDup}" is used twice`);
  if (issues.length > 0) throw new GameDataError(issues);

  return { units, buildings, nodes, resources, projectiles, game };
}

/** Cost as a list for display, skipping zero entries. */
export function costEntries(c: Partial<Record<ResourceType, number>>): Array<[ResourceType, number]> {
  return RESOURCE_TYPES.filter((r) => (c[r] ?? 0) > 0).map((r) => [r, c[r] ?? 0]);
}
