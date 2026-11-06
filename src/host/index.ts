/**
 * HOST (glue)
 * Creates a match and wires the engine, the human controller (UI) and the machine
 * player (AI worker) together. Owns the fixed-step game loop and the command log (PLAN §10).
 *
 * M2: boot → createGame → GameScreen, driven by GameHost's fixed-step loop.
 */
export { FixedStepClock } from './clock';
export { GameHost } from './GameHost';
export { bootGame } from './boot';
