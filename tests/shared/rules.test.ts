/** Match pace presets (src/data/pace.json, docs/plans/m7-menus-art-maps.md §3). */
import { describe, expect, it } from 'vitest';
import paceJson from '../../src/data/pace.json';
import { GAME_DATA } from '../../src/engine';
import { applyRules, defaultRules, parsePaceFile, rulesForPace } from '../../src/shared';

const PACE = parsePaceFile(paceJson);

describe('pace presets', () => {
  it('pace.json is valid and has the four presets in menu order', () => {
    expect(PACE.presets.map((p) => p.id)).toEqual(['relaxed', 'standard', 'fast', 'blitz']);
    expect(PACE.default).toBe('standard');
  });

  it('the Standard preset equals game.json (the engine default)', () => {
    expect(rulesForPace(PACE, 'standard')).toEqual(defaultRules(GAME_DATA.game));
  });

  it('an unknown or missing id gives the default preset', () => {
    expect(rulesForPace(PACE, 'warp').pace).toBe('standard');
    expect(rulesForPace(PACE, null).pace).toBe('standard');
  });

  it('Blitz is the fastest and has a bigger stockpile and pop cap', () => {
    const blitz = rulesForPace(PACE, 'blitz');
    expect(blitz.gatherRate).toBe(2);
    expect(blitz.buildSpeed).toBe(2.5);
    expect(blitz.popCap).toBe(125);
    expect(blitz.startingResources).toEqual({ food: 1000, wood: 1000, gold: 600 });
  });

  it('rejects a broken file with a readable message', () => {
    const broken = structuredClone(paceJson) as { default: string; presets: Array<Record<string, unknown>> };
    broken.default = 'nope';
    broken.presets[0]!.startingResources = 'lots';
    expect(() => parsePaceFile(broken)).toThrow(/unknown startingResources "lots"[\s\S]*default "nope"/);
  });

  it('applyRules fills the match rules into a copy of the game data', () => {
    const fast = rulesForPace(PACE, 'fast');
    const data = applyRules(GAME_DATA, fast);
    expect(data.game.pace).toEqual({ gatherRate: 1.5, buildSpeed: 1.5, trainSpeed: 1.5 });
    expect(data.game.startingResources).toEqual({ food: 500, wood: 500, gold: 300 });
    expect(GAME_DATA.game.pace.gatherRate).toBe(1); // the original is untouched
  });
});
