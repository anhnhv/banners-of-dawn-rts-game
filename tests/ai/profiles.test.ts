/** Mode profiles (src/ai/profiles/*.json): valid, and every setting documented in docs/ai-modes.md. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AI_MODES, PROFILES } from '../../src/ai';
import { parseAIProfile } from '../../src/shared';

const DOC = readFileSync(new URL('../../docs/ai-modes.md', import.meta.url), 'utf8');

function leafKeys(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? leafKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('AI mode profiles', () => {
  it('every mode has a valid profile', () => {
    for (const mode of AI_MODES) expect(PROFILES[mode].name).toBeTruthy();
  });

  it('rejects broken profiles with a readable message', () => {
    const broken = structuredClone(PROFILES.easy) as Record<string, unknown>;
    (broken.tempo as Record<string, unknown>).daydreamChance = 2;
    delete broken.attack;
    expect(() => parseAIProfile(broken, 'broken')).toThrow(/tempo\.daydreamChance[\s\S]*attack/);
  });

  it('every setting is in the configuration table of docs/ai-modes.md', () => {
    const keys = leafKeys(PROFILES.easy).filter((k) => !['note', 'name', 'persona'].includes(k));
    const missing = keys.filter((k) => !DOC.includes(`\`${k}\``));
    expect(missing).toEqual([]);
  });
});
