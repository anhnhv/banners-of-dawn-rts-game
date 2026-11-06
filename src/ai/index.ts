/**
 * MACHINE PLAYER (AI): public API
 * A separate module. It is local, rule-based TypeScript that runs in a Web Worker (PLAN §6).
 *
 * Hard rules (enforced by eslint.config.js and tests/lint/architecture.test.ts):
 *  - imports only src/shared and its own files; never the engine, UI or host
 *  - no npm packages
 *  - no network of any kind: no LLM, no AI agent, no third-party API
 *  - sees the world only through fog-filtered Observations; acts only through Commands
 *
 * Implemented in M8/M9.
 */
export const AI_INFO = {
  name: 'Banners of Dawn machine player',
  kind: 'local-rule-based',
  difficulties: ['easy', 'normal', 'hard'],
} as const;

export type Difficulty = (typeof AI_INFO.difficulties)[number];
