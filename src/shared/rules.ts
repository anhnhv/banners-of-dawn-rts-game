/**
 * Match rules (PLAN §2.11, §4.5): the pace of one match, chosen in Match Setup and fixed for the
 * whole match. Presets live in src/data/pace.json (validated here). The engine stores the rules in
 * its state; the UI uses them for the real times in tooltips; the machine player gets game data
 * with these values already filled in.
 */
import { z } from 'zod';
import { RESOURCE_TYPES, type GameConfig, type GameData, type ResourceAmounts } from './gameData';

export interface MatchRules {
  /** Pace preset id (for display), e.g. "standard". */
  pace: string;
  /** Multiplies every gather rate. */
  gatherRate: number;
  /** Multiplies construction speed (build time is divided by it). */
  buildSpeed: number;
  /** Multiplies training speed (train time is divided by it). */
  trainSpeed: number;
  startingResources: ResourceAmounts;
  popCap: number;
}

const amounts = z.object(
  Object.fromEntries(RESOURCE_TYPES.map((r) => [r, z.number().int().min(0)])) as Record<
    (typeof RESOURCE_TYPES)[number],
    z.ZodNumber
  >,
);
const factor = z.number().min(0.25).max(4);

export const PacePresetSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  /** Target match length, shown next to the name. */
  length: z.string().default(''),
  description: z.string().default(''),
  gatherRate: factor,
  buildSpeed: factor,
  trainSpeed: factor,
  /** Name of a set in `startingResources`. */
  startingResources: z.string(),
  popCap: z.number().int().min(10).max(400),
});
export type PacePreset = z.infer<typeof PacePresetSchema>;

export const PaceFileSchema = z
  .object({
    default: z.string(),
    startingResources: z.record(z.string(), amounts),
    presets: z.array(PacePresetSchema).min(1),
  })
  .superRefine((file, ctx) => {
    const ids = new Set<string>();
    for (const p of file.presets) {
      if (ids.has(p.id)) ctx.addIssue({ code: 'custom', message: `pace preset "${p.id}" is listed twice` });
      ids.add(p.id);
      if (!(p.startingResources in file.startingResources))
        ctx.addIssue({
          code: 'custom',
          message: `pace preset "${p.id}": unknown startingResources "${p.startingResources}"`,
        });
    }
    if (!ids.has(file.default))
      ctx.addIssue({ code: 'custom', message: `pace default "${file.default}" is not a preset` });
  });
export type PaceFile = z.infer<typeof PaceFileSchema>;

/** Validate src/data/pace.json; throws with every problem listed. */
export function parsePaceFile(raw: unknown): PaceFile {
  const parsed = PaceFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`src/data/pace.json is invalid:\n${issues.join('\n')}`);
  }
  return parsed.data;
}

/** The rules of a preset; an unknown id gives the file's default preset. */
export function rulesForPace(file: PaceFile, id: string | null | undefined): MatchRules {
  const preset =
    file.presets.find((p) => p.id === id) ??
    file.presets.find((p) => p.id === file.default) ??
    (file.presets[0] as PacePreset);
  const start = file.startingResources[preset.startingResources] ?? { food: 0, wood: 0, gold: 0 };
  return {
    pace: preset.id,
    gatherRate: preset.gatherRate,
    buildSpeed: preset.buildSpeed,
    trainSpeed: preset.trainSpeed,
    startingResources: { ...start },
    popCap: preset.popCap,
  };
}

/** The rules game.json describes (the engine default when no rules are given; = Standard). */
export function defaultRules(game: GameConfig): MatchRules {
  return {
    pace: 'standard',
    gatherRate: game.pace.gatherRate,
    buildSpeed: game.pace.buildSpeed,
    trainSpeed: game.pace.trainSpeed,
    startingResources: {
      food: game.startingResources.food ?? 0,
      wood: game.startingResources.wood ?? 0,
      gold: game.startingResources.gold ?? 0,
    },
    popCap: game.popCap,
  };
}

/**
 * The game data as it is in this match: game.json's pace, pop cap and starting resources replaced
 * by the rules. Given to the machine player so it never has to apply the pace itself.
 */
export function applyRules(data: GameData, rules: MatchRules): GameData {
  return {
    ...data,
    game: {
      ...data.game,
      pace: { gatherRate: rules.gatherRate, buildSpeed: rules.buildSpeed, trainSpeed: rules.trainSpeed },
      popCap: rules.popCap,
      startingResources: { ...rules.startingResources },
    },
  };
}
