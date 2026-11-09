/**
 * BANNERS OF DAWN MACHINE PLAYER: a self-contained AI module (see README.md), kept apart from the
 * game like a third-party module. It is local, rule-based TypeScript that runs in a Web Worker
 * (PLAN §6, docs/ai-modes.md).
 *
 * Hard rules (enforced by eslint.config.js and tests/lint/architecture.test.ts):
 *  - imports only src/shared (the game's public data), its own files and zod
 *  - no network of any kind: no LLM, no AI agent, no third-party API
 *  - holds no configuration: every setting comes in through init(info, profile)
 *  - sees the world only through Observations; acts only through Commands
 */
import type { AIPlayer } from './contract';
import { MachinePlayer } from './AIPlayer';

export type { AIPlayer } from './contract';
export type { FromAIMessage, ToAIMessage } from './protocol';
export { AIProfileSchema, aiTicks, parseAIProfile, type AIProfile } from './profile';

export const AI_INFO = {
  name: 'Banners of Dawn machine player',
  kind: 'local-rule-based',
} as const;

export function createAIPlayer(): AIPlayer {
  return new MachinePlayer();
}
