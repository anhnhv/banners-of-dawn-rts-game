/**
 * MACHINE PLAYER (AI): public API
 * A separate module. It is local, rule-based TypeScript that runs in a Web Worker (PLAN §6,
 * docs/plans/m6-vs-machine.md, docs/ai-modes.md). Each mode is a JSON profile in profiles/.
 *
 * Hard rules (enforced by eslint.config.js and tests/lint/architecture.test.ts):
 *  - imports only src/shared and its own files; never the engine, UI or host
 *  - no npm packages
 *  - no network of any kind: no LLM, no AI agent, no third-party API
 *  - sees the world only through Observations; acts only through Commands
 */
import type { Command, Observation, StaticMapInfo } from '../shared';
import type { AIMode } from './profiles';
import { MachinePlayer } from './AIPlayer';
import { AI_MODES } from './profiles';

export { AI_MODES, DEFAULT_AI_MODE, PROFILES, isAIMode, type AIMode } from './profiles';

export const AI_INFO = {
  name: 'Banners of Dawn machine player',
  kind: 'local-rule-based',
  difficulties: AI_MODES,
} as const;

export interface AIPlayer {
  /** `mode` picks the profile (src/ai/profiles/<mode>.json); `seed` drives its few random choices. */
  init(info: StaticMapInfo, mode?: AIMode, seed?: number): void;
  /** Decide; the returned commands are meant for tick `obs.tick + delayTicks`. */
  think(obs: Observation): Command[];
  /** One line describing what the AI is doing (dev overlay). */
  debugText(): string;
  /** How often to call think(), in ticks. Valid after init(). */
  readonly thinkTicks: number;
  /** Reaction delay in ticks. Valid after init(). */
  readonly delayTicks: number;
}

export function createAIPlayer(): AIPlayer {
  return new MachinePlayer();
}
