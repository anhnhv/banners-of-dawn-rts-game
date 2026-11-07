/**
 * The machine player's modes. Each mode is one JSON file in this folder with every tunable number
 * (schema: src/shared/aiProfile.ts, explained in docs/ai-modes.md). To add a mode, add a file and
 * list it here.
 */
import { parseAIProfile, type AIProfile } from '../../shared';
import easy from './easy.json';
import normal from './normal.json';

export const AI_MODES = ['easy', 'normal'] as const;
export type AIMode = (typeof AI_MODES)[number];
export const DEFAULT_AI_MODE: AIMode = 'easy';

export const PROFILES: Record<AIMode, AIProfile> = {
  easy: parseAIProfile(easy, 'easy'),
  normal: parseAIProfile(normal, 'normal'),
};

export function isAIMode(s: string | null | undefined): s is AIMode {
  return (AI_MODES as readonly string[]).includes(s ?? '');
}
