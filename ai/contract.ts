/**
 * The contract of an AI player: what any machine player offers the host. The host creates one,
 * calls init() once, then think() every `thinkTicks` ticks, and applies the returned commands at
 * tick `obs.tick + delayTicks`.
 */
import type { Command, Observation, StaticMapInfo } from '../src/shared';
import type { AIProfile } from './profile';

export interface AIPlayer {
  /** `profile` must be checked with parseAIProfile(); `seed` drives its few random choices. */
  init(info: StaticMapInfo, profile: AIProfile, seed?: number): void;
  /** Decide; the returned commands are meant for tick `obs.tick + delayTicks`. */
  think(obs: Observation): Command[];
  /** One line describing what the AI is doing (dev overlay). */
  debugText(): string;
  /** How often to call think(), in ticks. Valid after init(). */
  readonly thinkTicks: number;
  /** Reaction delay in ticks. Valid after init(). */
  readonly delayTicks: number;
}
