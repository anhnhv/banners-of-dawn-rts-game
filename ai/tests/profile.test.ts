/** The AI module's settings schema (ai/profile.ts): what a valid profile is. */
import { describe, expect, it } from 'vitest';
import { aiTicks, parseAIProfile } from '..';
import { PROFILES } from '../../src/ai';

describe('AI profile schema', () => {
  it('accepts a full profile', () => {
    expect(parseAIProfile(structuredClone(PROFILES.normal), 'copy').name).toBe(PROFILES.normal.name);
  });

  it('rejects broken profiles with a readable message', () => {
    const broken = structuredClone(PROFILES.easy) as Record<string, unknown>;
    (broken.tempo as Record<string, unknown>).daydreamChance = 2;
    delete broken.attack;
    expect(() => parseAIProfile(broken, 'broken')).toThrow(/tempo\.daydreamChance[\s\S]*attack/);
  });

  it('rejects minWorkers above workerTarget', () => {
    const p = structuredClone(PROFILES.normal);
    p.economy.minWorkers = p.economy.workerTarget + 1;
    expect(() => parseAIProfile(p, 'bad')).toThrow(/minWorkers/);
  });

  it('aiTicks() turns seconds into ticks, at least 1', () => {
    const p = structuredClone(PROFILES.normal);
    p.tempo.thinkSeconds = 1.5;
    p.tempo.reactionSeconds = 0;
    expect(aiTicks(p, 20)).toEqual({ think: 30, delay: 1 });
  });
});
