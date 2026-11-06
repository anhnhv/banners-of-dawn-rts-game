/**
 * Proves that the architecture rules in eslint.config.js are really enforced (PLAN §3.3, §6.2):
 * code that crosses a module boundary or touches the network must produce a lint error.
 * Each case lints a small snippet *as if* it lived at the given path.
 */
import { ESLint } from 'eslint';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
let eslint: ESLint;

async function ruleIds(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(ROOT, file) });
  return (result?.messages ?? []).map((m) => m.ruleId ?? `fatal: ${m.message}`);
}

beforeAll(() => {
  eslint = new ESLint({ cwd: ROOT });
});

const BOUNDARY = 'boundaries/dependencies';

describe('machine player (src/ai) isolation', () => {
  const file = 'src/ai/__probe__.ts';

  it('may import shared', async () => {
    expect(
      await ruleIds(file, "import { TICK_RATE } from '../shared';\nexport const t = TICK_RATE;\n"),
    ).toEqual([]);
  });

  it.each([
    ['engine', "import { ENGINE_INFO } from '../engine';\nexport const x = ENGINE_INFO;\n"],
    ['ui', "import { createMapView } from '../ui';\nexport const x = createMapView;\n"],
    ['host', "import { FixedStepClock } from '../host';\nexport const x = FixedStepClock;\n"],
    ['data', "import palette from '../data/palette.json';\nexport const x = palette;\n"],
  ])('may NOT import %s', async (_name, code) => {
    expect(await ruleIds(file, code)).toContain(BOUNDARY);
  });

  it.each([
    ['fetch()', "export const p = fetch('https://example.com/ai');\n", 'no-restricted-globals'],
    ['globalThis.fetch()', "export const p = globalThis.fetch('https://x');\n", 'no-restricted-properties'],
    ['self.fetch()', "export const p = self.fetch('https://x');\n", 'no-restricted-properties'],
    ['WebSocket', "export const s = new WebSocket('wss://x');\n", 'no-restricted-globals'],
    ['XMLHttpRequest', 'export const r = new XMLHttpRequest();\n', 'no-restricted-globals'],
    ['EventSource', "export const e = new EventSource('https://x');\n", 'no-restricted-globals'],
    ['importScripts', "importScripts('https://cdn.example.com/agent.js');\n", 'no-restricted-globals'],
    [
      'navigator.sendBeacon',
      "export const b = navigator.sendBeacon('https://x', '');\n",
      'no-restricted-properties',
    ],
  ])('may NOT use the network: %s', async (_name, code, rule) => {
    expect(await ruleIds(file, code)).toContain(rule);
  });

  it('may NOT import npm packages', async () => {
    expect(await ruleIds(file, "import { z } from 'zod';\nexport const s = z.string();\n")).toContain(
      'no-restricted-imports',
    );
  });

  it('may NOT use the DOM or Math.random', async () => {
    expect(await ruleIds(file, 'export const t = document.title;\n')).toContain('no-restricted-globals');
    expect(await ruleIds(file, 'export const r = Math.random();\n')).toContain('no-restricted-properties');
  });
});

describe('engine (src/engine) purity', () => {
  const file = 'src/engine/__probe__.ts';

  it('may import shared and data', async () => {
    expect(
      await ruleIds(
        file,
        "import { TICK_RATE } from '../shared';\nimport palette from '../data/palette.json';\nexport const x = [TICK_RATE, palette];\n",
      ),
    ).toEqual([]);
  });

  it.each([
    ['ui', "import { createMapView } from '../ui';\nexport const x = createMapView;\n"],
    ['ai', "import { AI_INFO } from '../ai';\nexport const x = AI_INFO;\n"],
    ['host', "import { FixedStepClock } from '../host';\nexport const x = FixedStepClock;\n"],
  ])('may NOT import %s', async (_name, code) => {
    expect(await ruleIds(file, code)).toContain(BOUNDARY);
  });

  it.each([
    ['Math.random', 'export const r = Math.random();\n', 'no-restricted-properties'],
    ['Date.now', 'export const n = Date.now();\n', 'no-restricted-globals'],
    ['performance.now', 'export const n = performance.now();\n', 'no-restricted-globals'],
    ['document', 'export const t = document.title;\n', 'no-restricted-globals'],
    ['window', 'export const w = window.innerWidth;\n', 'no-restricted-globals'],
    ['fetch', "export const p = fetch('https://x');\n", 'no-restricted-globals'],
  ])('may NOT use %s', async (_name, code, rule) => {
    expect(await ruleIds(file, code)).toContain(rule);
  });
});

describe('UI, shared and host boundaries', () => {
  it('UI may NOT import the engine or the AI', async () => {
    const file = 'src/ui/__probe__.ts';
    expect(
      await ruleIds(file, "import { ENGINE_INFO } from '../engine';\nexport const x = ENGINE_INFO;\n"),
    ).toContain(BOUNDARY);
    expect(await ruleIds(file, "import { AI_INFO } from '../ai';\nexport const x = AI_INFO;\n")).toContain(
      BOUNDARY,
    );
  });

  it('shared may NOT import any other module', async () => {
    const file = 'src/shared/__probe__.ts';
    expect(
      await ruleIds(file, "import { ENGINE_INFO } from '../engine';\nexport const x = ENGINE_INFO;\n"),
    ).toContain(BOUNDARY);
  });

  it('host may wire engine, AI and UI together', async () => {
    const file = 'src/host/__probe__.ts';
    const code =
      "import { ENGINE_INFO } from '../engine';\nimport { AI_INFO } from '../ai';\nimport { createMapView } from '../ui';\nexport const x = [ENGINE_INFO, AI_INFO, createMapView];\n";
    expect(await ruleIds(file, code)).toEqual([]);
  });
});
