// ESLint flat config for Banners of Dawn.
//
// Besides normal code-quality rules, this file ENFORCES THE ARCHITECTURE (PLAN §3.3):
//   - which module may import which (eslint-plugin-boundaries)
//   - no network APIs in the engine / machine player (PLAN §6.2: no external AI, no network)
//   - no DOM in engine / shared / AI
//   - the AI module (top-level ai/) holds no configuration: no JSON imports, settings come via init()
//   - no non-deterministic APIs in the engine (PLAN §5.1)
// tests/lint/architecture.test.ts proves that violations are actually reported.

import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const NETWORK_MSG =
  'Network access is forbidden here. The engine and the machine player must stay fully local (PLAN §6.2).';
const DOM_MSG = 'No DOM in this module. Only src/ui and src/host may touch the browser (PLAN §3.3).';
const DETERMINISM_MSG = 'Non-deterministic API. Use the seeded RNG / tick counter instead (PLAN §5.1).';

const NETWORK_NAMES = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'importScripts',
  'WebTransport',
  'RTCPeerConnection',
];
const networkGlobals = NETWORK_NAMES.map((name) => ({ name, message: NETWORK_MSG }));
const networkProperties = [
  ...NETWORK_NAMES.flatMap((property) =>
    ['globalThis', 'self', 'window'].map((object) => ({ object, property, message: NETWORK_MSG })),
  ),
  { object: 'navigator', property: 'sendBeacon', message: NETWORK_MSG },
];

const DOM_NAMES = [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'HTMLElement',
  'HTMLCanvasElement',
  'OffscreenCanvas',
  'Image',
  'Audio',
  'AudioContext',
  'alert',
];
const domGlobals = DOM_NAMES.map((name) => ({ name, message: DOM_MSG }));

const determinismGlobals = [
  { name: 'Date', message: DETERMINISM_MSG },
  { name: 'performance', message: DETERMINISM_MSG },
  { name: 'setTimeout', message: DETERMINISM_MSG },
  { name: 'setInterval', message: DETERMINISM_MSG },
];
const determinismProperties = [{ object: 'Math', property: 'random', message: DETERMINISM_MSG }];

// ---- Module boundaries ------------------------------------------------------------------------
// The first matching element wins, so ai/tests/** (tests) is listed before ai/** (the AI module).
const elements = [
  { type: 'tests', pattern: ['tests/**', 'ai/tests/**'], partialMatch: false },
  { type: 'shared', pattern: 'src/shared/**', partialMatch: false },
  { type: 'engine', pattern: 'src/engine/**', partialMatch: false },
  // The machine player: a self-contained module at the top level, like a third-party module.
  { type: 'ai', pattern: 'ai/**', partialMatch: false },
  // The app's AI settings (difficulty modes): configuration only, no algorithm.
  { type: 'aiConfig', pattern: 'src/ai/**', partialMatch: false },
  { type: 'ui', pattern: 'src/ui/**', partialMatch: false },
  { type: 'host', pattern: 'src/host/**', partialMatch: false },
  { type: 'data', pattern: 'src/data/**', partialMatch: false },
  // src/main.ts (the 5-line browser entry that wires ui + host) is deliberately not an element.
  { type: 'maps', pattern: 'maps/**', partialMatch: false },
  { type: 'tools', pattern: 'tools/**', partialMatch: false },
];

const allow = (from, to, message) => ({
  from: { element: { type: from } },
  allow: { to: { element: { types: to } } },
  ...(message ? { message } : {}),
});

const dependencyPolicies = [
  allow('shared', ['shared']),
  allow('engine', ['shared', 'engine', 'data']),
  allow('ai', ['shared', 'ai']),
  allow('aiConfig', ['shared', 'ai', 'aiConfig']),
  allow('ui', ['shared', 'ui', 'data']),
  allow('host', ['shared', 'engine', 'ai', 'aiConfig', 'ui', 'host', 'data']),
  allow('tools', ['shared', 'engine', 'ai', 'aiConfig', 'ui', 'host', 'data', 'maps', 'tools']),
  allow('tests', ['shared', 'engine', 'ai', 'aiConfig', 'ui', 'host', 'data', 'maps', 'tools', 'tests']),
];

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'assets/**', 'coverage/**', 'sim-results/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ---- Defaults for all TS/JS -------------------------------------------------------------------
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },

  // ---- Architecture: who may import whom -----------------------------------------------------------
  {
    files: ['src/**/*.ts', 'ai/**/*.ts', 'tools/**/*.ts', 'tests/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: 'tsconfig.json' },
      },
      'boundaries/elements': elements,
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkUnknownLocals: true,
          message:
            'Module boundary violation: "{{ from.element.type }}" may not import "{{ to.element.type }}" (PLAN §3.3).',
          policies: dependencyPolicies,
        },
      ],
    },
  },

  // ---- Environments -----------------------------------------------------------------------------
  {
    files: ['src/ui/**/*.ts', 'src/host/**/*.ts', 'src/main.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['ai/**/*.ts'],
    ignores: ['ai/tests/**'],
    languageOptions: { globals: { ...globals.worker } },
  },
  {
    files: [
      'tools/**/*.{ts,mjs,js}',
      'tests/**/*.ts',
      'ai/tests/**/*.ts',
      '*.config.{ts,js}',
      'eslint.config.js',
    ],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },

  // ---- Shared and the app's AI settings: pure, no DOM, no network ----------------------------------
  {
    files: ['src/shared/**/*.ts', 'src/ai/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...networkGlobals, ...domGlobals],
      'no-restricted-properties': ['error', ...networkProperties],
    },
  },

  // ---- Engine: pure, deterministic, no DOM, no network -------------------------------------------
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...networkGlobals, ...domGlobals, ...determinismGlobals],
      'no-restricted-properties': ['error', ...networkProperties, ...determinismProperties],
    },
  },

  // ---- Machine player (ai/): local only (PLAN §6.2), no configuration of its own -----------------------
  {
    files: ['ai/**/*.ts'],
    ignores: ['ai/tests/**'],
    rules: {
      'no-restricted-globals': ['error', ...networkGlobals, ...domGlobals],
      'no-restricted-properties': ['error', ...networkProperties, ...determinismProperties],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // zod (pure local validation of its settings schema) is the one package allowed.
              regex: '^(?!\\.{1,2}/|zod$)',
              message:
                'The machine player may not import packages (only zod). Use only src/shared and ai/ code (PLAN §6.2).',
            },
            {
              regex: '\\.json($|\\?)',
              message:
                'The machine player holds no configuration: settings come in through AIPlayer.init(info, profile).',
            },
          ],
        },
      ],
    },
  },
);
