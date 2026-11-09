/**
 * The machine player's settings (a "profile"): every tunable number it plays with.
 * The AI module owns this schema; the app owns the values (e.g. its difficulty modes in
 * src/ai/profiles/<mode>.json, explained in docs/ai-modes.md) and passes one checked profile to
 * AIPlayer.init(). Times are seconds, distances tiles, chances 0..1, priorities: higher is bought first.
 */
import { z } from 'zod';

const num = z.number().min(0);
const chance = z.number().min(0).max(1);
const span = z.tuple([num, num]);

export const AIProfileSchema = z.object({
  note: z.string().optional(),
  name: z.string().min(1),
  /** Who this mode pretends to be (for people reading the file). */
  persona: z.string().default(''),
  tempo: z.object({
    thinkSeconds: z.number().positive(),
    reactionSeconds: num,
    maxCommandsPerThink: z.number().int().positive(),
    /** Chance that a think is skipped entirely ("not paying attention"). */
    daydreamChance: chance,
  }),
  economy: z.object({
    workerTarget: z.number().int().min(0),
    minWorkers: z.number().int().min(0),
    armyReserve: num,
    workerQueue: z.number().int().min(0),
    idleWorkersPerThink: z.number().int().min(0),
    gatherRadius: num,
    /** 0 = never moves workers between resources. */
    rebalanceSeconds: num,
    plentyStock: num,
    /** Build the first gather building (a Farm) once the food left in safe nodes drops below this. */
    farmWhenFoodBelow: num,
  }),
  buildings: z.object({
    houseBuffer: z.number().int(),
    houseBufferPerProducer: z.number().int().min(0),
    firstProducerAtWorkers: z.number().int().min(0),
    maxProducersPerType: z.number().int().min(0),
    /** How many different kinds of army building it builds, in game.json → buildMenu order. */
    militaryBuildingTypes: z.number().int().min(0),
    extraProducerBank: num,
    towers: z.number().int().min(0),
    towerAfterSeconds: num,
    /** [preferred, max] distance from the Town Hall. */
    houseDistance: span,
    militaryDistance: span,
    towerDistance: span,
    /** At most this many gather buildings (Farms); 0 = never builds one. */
    maxFarms: z.number().int().min(0),
    farmDistance: span,
    /** No army building that trains only siege units (the Siege Workshop) before this. */
    siegeAfterSeconds: num,
  }),
  priorities: z.object({
    defenceSoldier: z.number(),
    house: z.number(),
    worker: z.number(),
    firstProducer: z.number(),
    soldier: z.number(),
    extraProducer: z.number(),
    tower: z.number(),
    farm: z.number(),
    /** Siege units (Catapults), up to army.maxSiege. */
    siege: z.number(),
  }),
  army: z.object({
    militaryQueue: z.number().int().min(0),
    /** Minimum time between two soldier orders (0 = no limit). */
    trainEverySeconds: num,
    stagingDistance: num,
    defenceHp: num,
    reissueSeconds: num,
    /**
     * What to train: 'first' = always the building's first button, 'fewest' = the type it has
     * fewest of, 'random' = any button (seeded), 'counter' = the best answer to the enemy army it
     * sees (see counterShare).
     */
    unitChoice: z.enum(['first', 'fewest', 'random', 'counter']),
    /** With 'counter': share of soldiers that follow the counter pick; the rest use 'fewest'. */
    counterShare: chance,
    /** With 'counter': how much more a ranged unit is worth against melee units (free shots while they walk in). */
    counterRangedEdge: num,
    /**
     * With 'counter': a building trains only if its best answer scores at least this share of the
     * best answer of all its army buildings (0 = always trains). Keeps Stables idle against spears.
     */
    counterMinShare: chance,
    /** Siege units (Catapults) alive or queued at a time; 0 = never trains one. */
    maxSiege: z.number().int().min(0),
  }),
  attack: z.object({
    earliestAttackSeconds: num,
    minWavePop: num,
    waveGrowth: num,
    /** 0 = does not compare strengths at all. */
    attackRatio: num,
    stalledSeconds: num,
    minStalledWavePop: num,
    stalledAttackRatio: num,
    desperationSeconds: z.number().positive(),
    desperateRatio: num,
    /** 0 = no gathering before an attack (units run off as they are). */
    regroupSeconds: num,
    regroupArrivedShare: chance,
    /** At most this many soldiers attack at the same time; the rest stay home (0 = the whole army). */
    groupSize: z.number().int().min(0),
    /** What the army goes for: the Town Hall (wins the game) or whatever enemy building is nearest. */
    target: z.enum(['townHall', 'nearestBuilding']),
  }),
  retreat: z.object({
    /** 0 = never retreats. */
    retreatRatio: num,
    retreatCooldownSeconds: num,
    retreatGiveUpSeconds: num,
  }),
  defence: z.object({
    threatRadius: num,
    /** Chance to notice a new attack on the base at all. */
    defendChance: chance,
    homeRadius: num,
    raidShare: num,
  }),
});

export type AIProfile = z.infer<typeof AIProfileSchema>;

export function parseAIProfile(raw: unknown, id: string): AIProfile {
  const r = AIProfileSchema.safeParse(raw);
  if (!r.success)
    throw new Error(
      `AI profile "${id}" is invalid:\n  - ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  - ')}`,
    );
  if (r.data.economy.minWorkers > r.data.economy.workerTarget)
    throw new Error(`AI profile "${id}": economy.minWorkers is above economy.workerTarget`);
  return r.data;
}

/** Think interval and reaction delay of a profile, in ticks (both at least 1). */
export function aiTicks(profile: AIProfile, tickRate: number): { think: number; delay: number } {
  return {
    think: Math.max(1, Math.round(profile.tempo.thinkSeconds * tickRate)),
    delay: Math.max(1, Math.round(profile.tempo.reactionSeconds * tickRate)),
  };
}
