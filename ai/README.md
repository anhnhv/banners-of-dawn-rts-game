# `ai/`: the Banners of Dawn machine player

A self-contained AI module, kept apart from the game like a third-party module. It is local,
rule-based TypeScript that runs in a Web Worker. It holds **no configuration**: the app hands it a
profile (every number it plays with) when a match starts. The game's difficulty modes are such
profiles, and they belong to the app (`src/ai/profiles/<mode>.json`), not to this module.

## Hard rules

Enforced by `eslint.config.js` and proved by `tests/lint/architecture.test.ts`:

- imports only `src/shared` (the game's public data: `Observation`, `StaticMapInfo`, `Command`,
  `GameData`, the seeded `Rng`), its own files, and `zod` (the one package allowed, for the
  settings schema);
- never the game engine, UI, host, game data, or the app's AI settings (`src/ai`);
- no network of any kind: no LLM, no AI agent, no third-party API;
- no JSON imports: every setting comes in through `init()`;
- no DOM, no `Math.random` (use the seeded `Rng`).

## API (`index.ts`)

| Export                                                          | File          | What it is                                                                                   |
| --------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------- |
| `createAIPlayer()`                                              | `index.ts`    | A new machine player                                                                         |
| `AIPlayer`                                                      | `contract.ts` | What any AI player offers the host: `init`, `think`, `debugText`, `thinkTicks`, `delayTicks` |
| `ToAIMessage`, `FromAIMessage`                                  | `protocol.ts` | Messages between the host and the worker (`worker.ts`)                                       |
| `AIProfileSchema`, `AIProfile`, `parseAIProfile()`, `aiTicks()` | `profile.ts`  | The settings schema: what a valid profile is                                                 |
| `AI_INFO`                                                       | `index.ts`    | Name and kind of this AI                                                                     |

```ts
const ai = createAIPlayer();
ai.init(game.staticInfo(player), parseAIProfile(rawJson, 'my-profile'), seed);
// every ai.thinkTicks ticks:
const commands = ai.think(game.observe(player, events)); // apply at obs.tick + ai.delayTicks
```

In the browser the host runs it through `worker.ts`: it posts
`{ type: 'init', info, profile, seed }`, then `{ type: 'observe', obs }` each think, and receives
`{ type: 'commands', forTick, commands }` and `{ type: 'debug', text }`.

## Files

| File           | Job                                                                         |
| -------------- | --------------------------------------------------------------------------- |
| `AIPlayer.ts`  | The brain: situation → army posture → prioritized buying → worker jobs      |
| `situation.ts` | Reads an Observation into a situation (armies, threats, home)               |
| `Budget.ts`    | Spends resources by priority so cheap requests cannot starve important ones |
| `counters.ts`  | Picks the soldier type that best answers the enemy army                     |
| `TileMap.ts`   | Where buildings can go                                                      |
| `worker.ts`    | Web Worker message bridge                                                   |

How the machine plays, and every profile setting, is explained in `docs/ai-modes.md`.

## Tests (`tests/`)

Run with the rest: `npm test` (vitest includes `ai/tests/**/*.test.ts`).

- `parts.test.ts`: budget, placement, counter pick
- `profile.test.ts`: the settings schema
- `engine.test.ts`: plays with any valid profile, not only the shipped modes; holds no config files
- `ai.test.ts`, `maps.test.ts`, `novice.test.ts`: headless matches against the real game (`sim.ts`)

The tests may import the whole game; the module itself may not.
