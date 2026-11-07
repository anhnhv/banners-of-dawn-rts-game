/**
 * Machine-player mode profiles (docs/ai-modes.md): every tunable number of one difficulty mode.
 * The files live in src/ai/profiles/<mode>.json; this schema checks them when the AI starts and in
 * tests. Times are seconds, distances tiles, chances 0..1, priorities: higher is bought first.
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
  }),
  buildings: z.object({
    houseBuffer: z.number().int(),
    houseBufferPerProducer: z.number().int().min(0),
    firstProducerAtWorkers: z.number().int().min(0),
    maxProducersPerType: z.number().int().min(0),
    extraProducerBank: num,
    towers: z.number().int().min(0),
    towerAfterSeconds: num,
    /** [preferred, max] distance from the Town Hall. */
    houseDistance: span,
    militaryDistance: span,
    towerDistance: span,
  }),
  priorities: z.object({
    defenceSoldier: z.number(),
    house: z.number(),
    worker: z.number(),
    firstProducer: z.number(),
    soldier: z.number(),
    extraProducer: z.number(),
    tower: z.number(),
  }),
  army: z.object({
    militaryQueue: z.number().int().min(0),
    /** Minimum time between two soldier orders (0 = no limit). */
    trainEverySeconds: num,
    stagingDistance: num,
    defenceHp: num,
    reissueSeconds: num,
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
