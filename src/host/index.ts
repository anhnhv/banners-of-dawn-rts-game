/**
 * HOST (glue)
 * Creates a match and wires the engine, the human controller (UI) and the machine
 * player (AI worker) together. Owns the fixed-step game loop and the command log (PLAN §10).
 *
 * boot → createGame → GameScreen (+ the machine player's controller), driven by GameHost's loop.
 */
export { FixedStepClock } from './clock';
export { GameHost } from './GameHost';
export { bootGame } from './boot';
export { isAIMode, type AIMode } from '../ai';
export { InlineAIController, WorkerAIController, type AIController } from './aiController';
