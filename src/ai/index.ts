/**
 * The app's machine-player settings: the difficulty modes and their configs (docs/ai-modes.md).
 * This is configuration only. The AI itself is the separate module in ai/ (top level), which
 * takes one of these profiles in AIPlayer.init().
 */
export { AI_MODES, DEFAULT_AI_MODE, PROFILES, isAIMode, type AIMode } from './profiles';
