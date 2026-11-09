# Plan: move the machine-player engine out of `src/` (status: v2, approved and done 2026-11-09)

**Goal.** The AI becomes a self-contained module in a top-level `ai/` folder, next to `docs/` and
`maps/`, treated **like a third-party module**: it holds its algorithm, its own contract (the
`AIPlayer` interface, the worker messages), the schema of its settings, and its tests. It knows
nothing about difficulty modes. The mode configs (`easy.json`, `normal.json`) are app-level
settings and **stay where they are** in `src/ai/profiles/`. The app picks a config and hands it to
the engine.

**Why now.** Later, players should be able to make their own AI for auto play. That needs a clean
line between:

- **the engine**: the code that plays, and what it accepts (`ai/`), and
- **its settings**: plain data the app owns, picks, and later lets the player edit (`src/ai/profiles/`).

**Gameplay does not change.** Same decisions, same random rolls, same commands on the same ticks.
This is only a move and an API change.

**Decisions from your review (2026-11-09):**

| #   | Question          | Answer                                                                                    |
| --- | ----------------- | ----------------------------------------------------------------------------------------- |
| Q1  | Folder name       | `ai/` at the top level                                                                    |
| Q2  | Tests             | Move to `ai/tests/`                                                                       |
| Q3  | Contract + schema | The AI is like a third-party module: its contract and settings schema move into `ai/` too |
| Q4  | `zod` in `ai/`    | Keep using `zod` (the one package allowed in the AI module)                               |

**As built (review, 2026-11-09):** three changes from the plan below.

- `profileFor()` (sections 2.7, 5) was **not** kept: nothing in the app needs it. `boot.ts` must not
  turn an unknown mode into Easy; an unknown mode means no AI.
- `ai/worker.ts` checks the profile it receives with `parseAIProfile()`. A worker message is a trust
  boundary, and later profiles may be made by players. A bad profile throws, and the host shows
  "Machine player crashed: …".
- The no-JSON lint rule for `ai/` also catches imports with a query (`./x.json?raw`).

---

## 1. Where things are today and where they go

### 1.1 Today

```
src/ai/
  AIPlayer.ts      769 lines  the brain (imports PROFILES itself and picks a mode)
  Budget.ts         49        priority budget
  counters.ts       77        counter pick
  situation.ts     203        situation analysis
  TileMap.ts        81        building placement map
  index.ts          40        public API: createAIPlayer, AI_INFO, AIPlayer interface, re-exports modes
  worker.ts         23        Web Worker bridge (gets a mode name and looks it up)
  tsconfig.json
  profiles/
    easy.json, normal.json    mode configs
    index.ts                  AI_MODES, DEFAULT_AI_MODE, PROFILES, isAIMode
src/shared/
  ai.ts             Observation, StaticMapInfo, ToAIMessage / FromAIMessage
  aiProfile.ts      AIProfileSchema (zod), parseAIProfile()
tests/ai/
  ai.test.ts, maps.test.ts, novice.test.ts, parts.test.ts, profiles.test.ts, sim.ts
```

The problem: the engine (`AIPlayer.ts`) imports `./profiles` and picks the config by mode name, so
the code and the settings are tied together, and the AI's contract is spread over `src/shared`.

### 1.2 After

```
ai/                         NEW top-level folder: the whole AI module, no mode configs
  README.md                 NEW: what the module is, its hard rules, its API, how to test it
  index.ts                  public API (section 2.1)
  contract.ts               NEW: AIPlayer interface (moved from src/ai/index.ts)
  protocol.ts               NEW: ToAIMessage / FromAIMessage (moved from src/shared/ai.ts)
  profile.ts                NEW: AIProfileSchema, AIProfile, parseAIProfile, aiTicks
                                 (moved from src/shared/aiProfile.ts, + aiTicks)
  AIPlayer.ts               moved; takes a profile object instead of a mode name
  Budget.ts                 moved, unchanged
  counters.ts               moved, unchanged
  situation.ts              moved; imports AIProfile from ./profile
  TileMap.ts                moved, unchanged
  worker.ts                 moved; its 'init' message carries the profile itself
  tsconfig.json             moved (extends ../tsconfig.base.json, excludes tests/)
  tests/
    parts.test.ts           moved from tests/ai (unit tests: budget, placement, counter pick)
    engine.test.ts          NEW: the engine plays with any valid profile, not only shipped modes
    profile.test.ts         NEW: split from profiles.test.ts — the schema rejects a bad profile
    ai.test.ts              moved (headless matches against the real game)
    maps.test.ts            moved
    novice.test.ts          moved
    sim.ts                  moved (headless match helper)

src/ai/                     STAYS: the app's AI settings only (no algorithm)
  index.ts                  REWRITTEN: re-exports profiles/ (mode list for menus, boot, tests)
  tsconfig.json             kept; lib ES2023 only
  profiles/
    easy.json               NOT MOVED, NOT CHANGED
    normal.json             NOT MOVED, NOT CHANGED
    index.ts                NOT MOVED; imports parseAIProfile from the ai module; + profileFor(mode)

src/shared/
  ai.ts                     keeps only what the GAME publishes to any AI: Rect, StaticMapInfo,
                            Observation, Observed*, UnitOrderInfo (the game engine builds these in
                            Game.observe() / Game.staticInfo(), and it may not import ai/)
  aiProfile.ts              DELETED (moved to ai/profile.ts)

tests/
  aiConfig/profiles.test.ts moved from tests/ai/profiles.test.ts (see 4.1)
  engine/helpers.ts         + mapFile(), GREEN_VALLEY (moved from tests/ai/sim.ts, see 4.1)
```

### 1.3 Who does what after the change

| Part                    | Folder             | Knows about modes? | Job                                                       |
| ----------------------- | ------------------ | ------------------ | --------------------------------------------------------- |
| AI module               | `ai/`              | **no**             | Plays with whatever valid `AIProfile` it is given         |
| — its contract          | `ai/contract.ts`   | no                 | `AIPlayer`: what any AI implementation offers the host    |
| — its worker protocol   | `ai/protocol.ts`   | no                 | Messages between the host and the AI worker               |
| — its settings schema   | `ai/profile.ts`    | no                 | What a valid profile is (`parseAIProfile()`)              |
| Game → AI data          | `src/shared/ai.ts` | no                 | `Observation`, `StaticMapInfo`: what the game shows an AI |
| App AI settings (modes) | `src/ai/profiles/` | yes                | The list of modes and their JSON files                    |
| Host                    | `src/host/`        | yes                | Turns the chosen mode into a profile, starts the AI       |

**Dependency direction** (arrows = "imports"):

```
            src/shared  (Observation, StaticMapInfo, Command, GameData)
             ▲    ▲   ▲
             │    │   └──────────────┐
         src/engine   ai/  ◄─── src/ai/profiles (settings use the AI's schema)
             ▲         ▲            ▲
             └──── src/host ────────┘
```

- `ai/` imports only `src/shared` (the game's public data types and the seeded `Rng`), its own
  files, and `zod`. Never the game engine, UI, host, data or the app's AI settings.
- The game engine never imports `ai/`, so the data it produces for an AI (`Observation`,
  `StaticMapInfo`) has to stay in `src/shared`. That is the "game's API" a third-party AI reads;
  everything the AI itself defines moves into `ai/`.

### 1.4 One relaxed rule: `zod` inside `ai/`

Today lint bans **every** npm package in the AI (PLAN §6.2), because the point is "no AI library,
no network". The settings schema uses `zod`. Two ways to move it:

- **A (planned): allow exactly `zod`** in `ai/`. `zod` is a pure, local validation library (no
  network, already a game dependency). Every other package stays banned, and the architecture test
  proves it (`import 'three'` / `import 'openai'` in `ai/` still fail lint).
- B: rewrite the schema by hand without `zod` (~150 lines of checks). More code to keep in sync,
  for no gain.

The no-network, no-DOM and no-`Math.random` rules are unchanged.

---

## 2. API changes (exact)

### 2.1 Module API: `ai/index.ts`

```ts
/**
 * BANNERS OF DAWN MACHINE PLAYER: a self-contained AI module (see README.md).
 * Hard rules (eslint.config.js, ai/tests/… and tests/lint/architecture.test.ts):
 *  - imports only src/shared (the game's public data), its own files and zod
 *  - no network of any kind: no LLM, no AI agent, no third-party API
 *  - holds no configuration: every setting comes in through init(…, profile)
 *  - sees the world only through Observations; acts only through Commands
 */
export const AI_INFO = { name: 'Banners of Dawn machine player', kind: 'local-rule-based' } as const;
// `difficulties` removed: the module has no modes

export type { AIPlayer } from './contract';
export type { FromAIMessage, ToAIMessage } from './protocol';
export { AIProfileSchema, parseAIProfile, aiTicks, type AIProfile } from './profile';

export function createAIPlayer(): AIPlayer {
  return new MachinePlayer();
}
```

### 2.2 Contract: `ai/contract.ts`

```ts
import type { Command, Observation, StaticMapInfo } from '../src/shared';
import type { AIProfile } from './profile';

export interface AIPlayer {
  /** `profile` must be checked with parseAIProfile(); `seed` drives its few random choices. */
  init(info: StaticMapInfo, profile: AIProfile, seed?: number): void;
  /** Decide; the returned commands are meant for tick `obs.tick + delayTicks`. */
  think(obs: Observation): Command[];
  /** One line describing what the AI is doing (dev overlay). */
  debugText(): string;
  readonly thinkTicks: number; // valid after init()
  readonly delayTicks: number; // valid after init()
}
```

### 2.3 Worker protocol: `ai/protocol.ts`

```ts
export type ToAIMessage =
  | { type: 'init'; info: StaticMapInfo; profile: AIProfile; seed: number } // was: mode: string
  | { type: 'observe'; obs: Observation }
  | { type: 'dispose' };

export type FromAIMessage =
  { type: 'commands'; forTick: number; commands: Command[] } | { type: 'debug'; text: string };
```

`AIProfile` is plain JSON data, so it can be posted to the Web Worker as it is.

### 2.4 Settings schema: `ai/profile.ts`

The current `src/shared/aiProfile.ts`, moved as it is (same fields, same checks, same error text),
plus one helper so the tick maths lives in one place:

```ts
/** Think interval and reaction delay in ticks for a profile (both at least 1). */
export function aiTicks(profile: AIProfile, tickRate: number): { think: number; delay: number } {
  return {
    think: Math.max(1, Math.round(profile.tempo.thinkSeconds * tickRate)),
    delay: Math.max(1, Math.round(profile.tempo.reactionSeconds * tickRate)),
  };
}
```

### 2.5 Engine internals: `ai/AIPlayer.ts`

```ts
// removed: import { DEFAULT_AI_MODE, PROFILES, type AIMode } from './profiles';
profile!: AIProfile;                          // was: = PROFILES[DEFAULT_AI_MODE]

get thinkTicks() { return aiTicks(this.profile, this.info.tickRate).think; }
get delayTicks() { return aiTicks(this.profile, this.info.tickRate).delay; }

init(info: StaticMapInfo, profile: AIProfile, seed = 1): void {
  this.profile = profile;                     // was: PROFILES[mode] ?? PROFILES[DEFAULT_AI_MODE]
  ...rest unchanged
}
```

Nothing else in the algorithm is touched. Import paths change from `'../shared'` to
`'../src/shared'`, and `AIProfile` comes from `'./profile'`.

### 2.6 Worker: `ai/worker.ts`

```ts
if (msg.type === 'init') ai.init(msg.info, msg.profile, msg.seed); // no isAIMode / mode lookup
```

### 2.7 App settings: `src/ai/profiles/index.ts`

```ts
import { parseAIProfile, type AIProfile } from '../../../ai';   // was: '../../shared'
...AI_MODES, AIMode, DEFAULT_AI_MODE, PROFILES, isAIMode unchanged...

/** The checked profile of a mode (unknown mode → the default mode). */
export function profileFor(mode: string | null | undefined): AIProfile {
  return PROFILES[isAIMode(mode) ? mode : DEFAULT_AI_MODE];
}
```

`src/ai/index.ts` becomes:

```ts
/** The app's machine-player settings: difficulty modes and their configs. The AI itself is ai/. */
export { AI_MODES, DEFAULT_AI_MODE, PROFILES, isAIMode, profileFor, type AIMode } from './profiles';
```

So `src/host/app.ts`, `src/host/boot.ts` and `src/host/index.ts`, which import modes from
`'../ai'`, keep those import lines (the path is still `src/ai`).

### 2.8 Host: `src/host/aiController.ts`

Both controllers take a **profile** instead of a mode:

```ts
constructor(game: Game, player: PlayerId, profile: AIProfile, sink?: Sink, seed = 1)
```

- `InlineAIController`: `this.ai.init(game.staticInfo(player), profile, seed)`.
- `WorkerAIController`: `this.thinkTicks = aiTicks(profile, info.tickRate).think` instead of
  building a throw-away "probe" AI; posts `{ type: 'init', info, profile, seed }`; worker URL
  `new URL('../../ai/worker.ts', import.meta.url)`.
- Imports: `createAIPlayer, aiTicks` and the types `AIPlayer, AIProfile, FromAIMessage,
ToAIMessage` from `'../../ai'`.

### 2.9 Host: `src/host/boot.ts`

```ts
if (setup.opponent !== IDLE_OPPONENT && isAIMode(setup.opponent))
  host.attachAI(new WorkerAIController(game, 1, PROFILES[setup.opponent], host.aiSink, seed));
```

This is the single place where "a mode name" turns into "a config". A player-made profile plugs in
here later (section 7).

### 2.10 `src/shared`

- `ai.ts`: keeps `Rect`, `StaticMapInfo`, `UnitOrderInfo`, `ObservedUnit`, `ObservedBuilding`,
  `ObservedNode`, `Observation`. Header comment: "what the game shows any AI". `ToAIMessage` /
  `FromAIMessage` removed (now in `ai/protocol.ts`).
- `aiProfile.ts`: deleted; `index.ts` stops exporting it.
- `setup.ts`: comment only (`opponent` is a mode id from `src/ai/profiles`).

---

## 3. Build, typecheck and lint changes

### 3.1 TypeScript

- `ai/tsconfig.json`: `extends: "../tsconfig.base.json"`, `lib: ["ES2023", "WebWorker"]`,
  `include: ["./**/*.ts"]`, **`exclude: ["tests"]`** (tests need Node and Vite types).
- Root `tsconfig.json`: `include` gains `"ai/tests/**/*.ts"`.
- `src/ai/tsconfig.json`: `lib: ["ES2023"]` only.
- `tools/typecheck.mjs`: projects become
  `['src/shared', 'src/engine', 'ai', 'src/ai', 'src/ui', 'src/host', '.']`.

### 3.2 Vitest / Vite

- `vite.config.ts` → `test.include: ['tests/**/*.test.ts', 'ai/tests/**/*.test.ts']`.
- No other Vite change expected: the Vite root is the project root, so `ai/worker.ts` is served in
  dev and bundled as a worker on build (`worker.format: 'es'` already set). `ai/` is code, so it
  is **not** added to `STATIC_DIRS`.
- `ai/tests/` is never bundled (only tests import it).

### 3.3 ESLint (`eslint.config.js`)

Elements (order matters: the first matching pattern wins, so `ai/tests/**` comes before `ai/**`):

| Element    | Pattern                   | Meaning                                    |
| ---------- | ------------------------- | ------------------------------------------ |
| `tests`    | `tests/**`, `ai/tests/**` | all tests (game tests and AI module tests) |
| `ai`       | `ai/**`                   | the AI module (was `src/ai/**`)            |
| `aiConfig` | `src/ai/**`               | NEW: the app's AI settings                 |

Who may import whom:

| From       | May import (changes in **bold**)                               |
| ---------- | -------------------------------------------------------------- |
| `ai`       | shared, ai (never engine, ui, host, data, **aiConfig**)        |
| `aiConfig` | **shared, ai, aiConfig** (the AI's schema, its own JSON files) |
| `host`     | shared, engine, ai, **aiConfig**, ui, host, data               |
| `tools`    | as today **+ aiConfig**                                        |
| `tests`    | as today **+ aiConfig**                                        |
| `engine`   | unchanged: shared, engine, data (never `ai`)                   |

Rule blocks:

- The boundaries block's `files` gains `'ai/**/*.ts'` (today it lists only `src/**`, `tools/**`,
  `tests/**`; without this the moved module would not be checked at all).
- Worker globals, the network ban, the DOM ban and the `Math.random` ban move from
  `src/ai/**/*.ts` to `ai/**/*.ts`, with `ignores: ['ai/tests/**']` (tests are Node code).
- "No npm packages" in `ai/**` keeps its regex but **allows `zod`** (section 1.4).
- **New rule for `ai/**` (not tests): no `.json` imports** (`no-restricted-imports` pattern
  `\.json$`). This enforces "the AI holds no configuration": settings only come in through `init()`.
- `ai/tests/**/*.ts` get Node globals and `no-console: off`, like `tests/**`.
- `src/ai/**` gets the same no-network / no-DOM rules as `src/shared`.

### 3.4 Prettier / git / deploy

- `ai/` is formatted like the rest (nothing to add to `.prettierignore`).
- `firebase.json` / `scripts/deploy.sh` deploy `dist/` only: no change.

---

## 4. Tests

### 4.1 What moves where

| File (today)                | After                             | Change                                                                                                                        |
| --------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `tests/ai/parts.test.ts`    | `ai/tests/parts.test.ts`          | imports `../Budget`, `../TileMap`, `../counters`; `PROFILES` from `../../src/ai`; `openMap` from `../../tests/engine/helpers` |
| `tests/ai/ai.test.ts`       | `ai/tests/ai.test.ts`             | `new InlineAIController(game, 1, 'normal')` → `…, PROFILES.normal)`; paths `../../src/…`                                      |
| `tests/ai/maps.test.ts`     | `ai/tests/maps.test.ts`           | paths only                                                                                                                    |
| `tests/ai/novice.test.ts`   | `ai/tests/novice.test.ts`         | paths only                                                                                                                    |
| `tests/ai/sim.ts`           | `ai/tests/sim.ts`                 | `modeOf(p)` → `PROFILES[modeOf(p)]` passed to the controller; `mapFile` / `GREEN_VALLEY` imported from `tests/engine/helpers` |
| `tests/ai/profiles.test.ts` | split in two (below)              |                                                                                                                               |
| —                           | `ai/tests/profile.test.ts`        | NEW: the schema part — a broken profile is rejected with every bad field listed                                               |
| —                           | `tests/aiConfig/profiles.test.ts` | the app part — every shipped mode is valid and every setting is in `docs/ai-modes.md`                                         |
| —                           | `ai/tests/engine.test.ts`         | NEW (see 4.2)                                                                                                                 |

Why the split and the helper move:

- The "every shipped mode is valid and documented" check is about the **app's** settings and the
  app's docs, not the AI module, so it stays with the game tests (`tests/aiConfig/`).
- `tests/engine/pace.test.ts` and `victory.test.ts` import `GREEN_VALLEY` from `tests/ai/sim.ts`.
  The game's tests should not depend on the AI module's tests, so `mapFile()` and `GREEN_VALLEY`
  move into `tests/engine/helpers.ts`; `ai/tests/sim.ts` imports them from there.

Note: `ai.test.ts`, `maps.test.ts` and `novice.test.ts` are integration tests (the AI plays real
headless matches through the game engine and the host's `InlineAIController`). They live in
`ai/tests/` as you asked; they import the game, the game never imports them.

### 4.2 New test `ai/tests/engine.test.ts`

- The AI runs with a profile that is **not** a shipped mode: a modified copy of
  `PROFILES.normal` (e.g. `tempo.thinkSeconds: 3`, `name: 'Custom'`), checked by
  `parseAIProfile()`. `thinkTicks` follows the new number, the debug text shows the custom name,
  and a 60-second headless match produces commands.
- The module holds no settings: `ai/` contains no `.json` file (a file-system check, backing up
  the lint rule).

### 4.3 `tests/lint/architecture.test.ts`

"Machine player isolation" block:

- probe file moves to `ai/__probe__.ts`; snippets import `'../src/shared'`, `'../src/engine'`,
  `'../src/ui'`, `'../src/host'`, `'../src/data/palette.json'`.
- **new:** the AI may NOT import the app's AI settings (`'../src/ai'`).
- **new:** the AI may NOT import a `.json` file, even its own (`'./x.json'`).
- **new:** the AI MAY import `zod`; it may still NOT import any other package (`'three'`, `'openai'`).
- the network / DOM / `Math.random` cases stay, at the new path.

New block for `src/ai/__probe__.ts` (app settings): may import `src/shared` and `ai/`; may NOT
import the game engine, UI or host. The existing "host / ui may (not) import ai" snippets are
updated to the new paths.

### 4.4 "Nothing changed" check (done during the work, not committed)

Before the move, record a fixed match: Green Valley, scenario start, Normal vs Easy, seed 5,
5 minutes, AI vs AI with `InlineAIController`, and hash every command (tick, player, command
JSON). After the move, the hash must be identical. This proves the refactor did not change one
decision. The script lives in the scratchpad, not in the repo.

---

## 5. Steps and done criteria

| #   | Step                                                                                                                  | Done when                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Record the command-hash baseline (4.4)                                                                                | hash saved in the scratchpad                                                 |
| 2   | `git mv` the engine files and tests into `ai/` and `ai/tests/` (keeps history); fix import paths                      | files moved                                                                  |
| 3   | `ai/contract.ts`, `ai/protocol.ts`, `ai/profile.ts` (+ `aiTicks`); trim `src/shared/ai.ts`; delete `aiProfile.ts`     | `src/shared` has no AI-owned types left                                      |
| 4   | Engine takes a profile (`AIPlayer.ts`, `worker.ts`, `index.ts`); `ai/README.md`                                       | `ai/` imports nothing from `src/ai` and no `.json`                           |
| 5   | `src/ai/index.ts` → settings only; `profileFor()`; profiles import the schema from `ai/`                              | modes still listed in Match Setup                                            |
| 6   | Host: controllers take a profile; `boot.ts` resolves mode → profile; worker URL                                       | `src/host` typechecks                                                        |
| 7   | tsconfigs, `typecheck.mjs`, vitest include, ESLint elements and rules                                                 | `npm run typecheck` and `npm run lint` pass                                  |
| 8   | Tests: split `profiles.test.ts`, move helpers, `engine.test.ts`, architecture cases                                   | `npm test` passes (including `ai/tests/`); command hash equals the baseline  |
| 9   | Real app: `npm run build`; play Easy and Normal for a minute in the browser (`npm run dev`)                           | build passes; the AI worker starts and plays (status line shows it thinking) |
| 10  | Docs: README module table, `docs/ai-modes.md` (code in `ai/`, schema in `ai/profile.ts`), PLAN.md §3 / §6 / §12 / §14 | `npm run check` passes                                                       |
| 11  | Commit (when you say so)                                                                                              | one commit                                                                   |

Old plan files (`docs/plans/m6-*.md`, `m6.5-*.md`, `m7-*.md`) describe history and are left as
they are; PLAN.md §6 gets a note that the AI moved to `ai/`.

---

## 6. Risks

| Risk                                                                   | Answer                                                                                                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Vite does not bundle a worker from outside `src/`                      | It should (root = project root). Step 9 checks it; fallback: a 3-line `src/host/aiWorker.ts` entry that imports `../../ai/worker` |
| ESLint import resolver does not see `ai/` (not in the root tsconfig)   | Relative imports resolve without the tsconfig; the architecture tests prove the rules fire                                        |
| `ai/tsconfig.json` picks up the tests and fails on Node / vitest types | `exclude: ["tests"]`; the root project typechecks `ai/tests/`                                                                     |
| A bad profile reaches the engine with no fallback                      | Every shipped profile goes through `parseAIProfile()` at load; unknown mode → `profileFor()` default                              |
| Allowing `zod` weakens "no packages in the AI"                         | Only `zod` is allowed, by name; a lint test proves every other package still fails                                                |
| `ai/` vs `src/ai/` names look alike                                    | Header comments and `ai/README.md` say "AI module" vs "the app's AI settings"                                                     |

---

## 7. Not in this step (the road to "players make their own AI")

So the direction is clear; none of this is built now:

1. **Custom settings.** A "Custom AI" editor in Match Setup: start from Easy or Normal, change
   numbers, save in `localStorage`, checked by `parseAIProfile()`, passed through the same
   `WorkerAIController(game, 1, profile, …)` line in `boot.ts`. The AI needs no change for this.
2. **Auto play for the human side.** The same AI driving player 0 (the code already supports any
   player id), with the player's own profile.
3. **Other AI modules.** Other code implementing `ai/contract.ts` + `ai/protocol.ts`, still
   local-only and in a worker (the no-network rule stays).

---

## 8. Questions for you

- **Q4. `zod` in `ai/`.** Allow exactly `zod` inside the AI module so the schema can move as it is
  (planned, section 1.4), or rewrite the schema by hand so the module uses no package at all?
