/**
 * Messages between the host and the AI's Web Worker (worker.ts). Plain data only, so they can be
 * posted to a worker. host → AI: init, observe, dispose. AI → host: commands, debug.
 */
import type { Command, Observation, StaticMapInfo } from '../src/shared';
import type { AIProfile } from './profile';

/** Messages to the AI worker. */
export type ToAIMessage =
  | { type: 'init'; info: StaticMapInfo; profile: AIProfile; seed: number }
  | { type: 'observe'; obs: Observation }
  | { type: 'dispose' };

/** Messages from the AI worker. */
export type FromAIMessage =
  { type: 'commands'; forTick: number; commands: Command[] } | { type: 'debug'; text: string };
