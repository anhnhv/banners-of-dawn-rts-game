/**
 * The app's AI settings (src/ai/profiles/*.json): every shipped mode is valid and every setting is
 * documented in docs/ai-modes.md. The schema itself is tested with the AI module (ai/tests).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AI_MODES, PROFILES } from '../../src/ai';

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

  it('every setting is in the configuration table of docs/ai-modes.md', () => {
    const keys = leafKeys(PROFILES.easy).filter((k) => !['note', 'name', 'persona'].includes(k));
    const missing = keys.filter((k) => !DOC.includes(`\`${k}\``));
    expect(missing).toEqual([]);
  });
});
