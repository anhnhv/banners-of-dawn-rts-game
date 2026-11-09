/**
 * SHARED CONTRACTS
 * The only code that the engine, machine player (AI), UI and host all depend on.
 * Rules: pure TypeScript, imports nothing from other modules, no DOM, no network.
 */
export * from './constants';
export * from './ids';
export * from './map';
export * from './mapSchema';
export * from './rng';
export * from './commands';
export * from './view';
export * from './gameData';
export * from './ai';
export * from './aiProfile';
export * from './rules';
export * from './setup';
