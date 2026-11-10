# M6: Play against the machine

Status: **implemented 2026-11-07** and waiting for the user's review. The first draft of this plan was reviewed and changed by the user on 2026-11-07; the decisions are in §0.

## 0. Decisions (user, 2026-11-07)

| #   | Question    | Decision                                                                                                                                                                                                                                |
| --- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Start       | **The machine plays by default.** It analyzes the current situation and decides; it does not follow a scripted build order, so it works from the scenario start and from the standard start                                             |
| 2   | New content | **No new units or buildings.** The AI uses what exists: workers (Town Hall), Militia (Barracks), Houses, Watch Tower, plus whatever the scenario gives it                                                                               |
| 3   | Fog         | **Full vision as now**, for both players. The observation contains every entity                                                                                                                                                         |
| 4   | Defeat      | **Keep it simple: losing your Town Hall loses the game** (`game.json → victory.defeatWhenLost: ["town_hall"]`)                                                                                                                          |
| 5   | Difficulty  | One difficulty, Easy, hard-coded at first. **Updated 2026-11-07:** each mode has its own config file `src/ai/profiles/<mode>.json`; Easy is now a relaxed opponent anyone can beat and the earlier logic became Normal (`docs/ai-modes.md`) |
| —   | Eras        | Dropped (2026-11-07): a single era. The `era` field was removed from `units.json` and the schema                                                                                                                                        |

Unchanged hard rules: the AI is only `src/ai/`, local rule-based TypeScript in a Web Worker, importing only `src/shared` and its own files, with **no network, no LLM and no third-party API** (PLAN §6.2; enforced by lint and `tests/lint/architecture.test.ts`).

How the machine plays, rule by rule and per mode, is described in `docs/ai-modes.md`.

## 1. What was built

### Engine

- `systems/victory.ts`:
  - A player who has owned a `defeatWhenLost` building and owns none any more (sites count) is defeated. Players who never had one, as in test arenas, never lose.
  - If both fall in the same tick, it is a draw.
  - It emits `gameOver { winner }` and sets `state.result`. The simulation then freezes: `step()` does nothing.
- `PlayerState.stats` holds units trained and lost, and buildings built and lost. `MatchResult { winner, tick, stats[] }` is in `PlayerView.result` and `game.result`.
- `game.observe(player, events)` returns the AI's `Observation`:
  - every unit with a summarized order (`idle`, `move`, `attackMove`, `gather` with node and resource, `attack`);
  - every building with its queue and rally point;
  - every live resource node;
  - resources, population and pop cap, and the events since the last observation.
  - It is plain data, so it can be posted to a Worker.
- `game.staticInfo(player)` returns the `StaticMapInfo`: buildable and passable tiles from terrain and rocks, the spawns, and the full parsed game data.

### Shared contracts (`src/shared/ai.ts`)

`StaticMapInfo`, `Observation`, `ObservedUnit`, `ObservedBuilding`, `ObservedNode` and `UnitOrderInfo`, plus the worker messages `ToAIMessage` (`init` / `observe` / `dispose`) and `FromAIMessage` (`commands` / `debug`).

### Machine player (`src/ai/`)

```
src/ai/
  index.ts        createAIPlayer(): AIPlayer { init, think, debugText, thinkTicks, delayTicks }
  worker.ts       Web Worker bridge (messages only)
  AIPlayer.ts     MachinePlayer: the think loop and every decision
  situation.ts    analyze(): the facts every decision uses
  Budget.ts       prioritized requests → approved commands, with a reservation for the top one
  TileMap.ts      where it may build: 1-tile free walkable ring around each footprint
  profiles/       one JSON per mode (easy.json, normal.json) + index.ts; schema in shared/aiProfile.ts
```

**Each think (every 1 s; commands apply 1.5 s later, like a human reaction):**

1. **Analyze** (`situation.ts`):
   - home and enemy Town Hall (from `victory.defeatWhenLost`), the front direction and a staging point;
   - workers, idle workers and gatherers per resource;
   - own army: population, strength (Σ hp × damage/cooldown) and center;
   - enemy army strength and enemy base defence (shooting buildings near their home);
   - threats (enemy soldiers within 12 tiles of an own building);
   - own buildings by type, producers per unit type, and free population after queues.
   - The **staging point** is in front of the base toward the enemy, on open ground just outside the reach of its own Town Hall and towers. The army meets the enemy in the field, as you asked for the scenario.
2. **Army posture:**
   - **defend**: when enemies are near the base, the army attack-moves to them, unless it is a small raid while the army is away.
   - **build**: idle soldiers go to the staging point.
   - **stage**: before an attack the army gathers, until 80% has arrived or 25 s have passed.
   - **attack**: the army attack-moves to the enemy Town Hall. When no enemy soldiers are close, every soldier attacks the Town Hall itself.
   - **retreat**: when the army is weaker than 0.6 × the enemy around it, it goes back to staging. The next wave then waits 40 s and needs 4 more population.
   - It attacks when the time is ≥ 5:00, the army has reached the wave size, and its strength is ≥ 1.6 × the enemy army plus base defence.
     - **If the army cannot grow any more** (no growth for 60 s, for example because the food has run out), it is enough to be about as strong as the enemy (1.0×).
     - The longer the standoff lasts, the more risk it accepts: the needed ratio drops to 0.6× over 3 more minutes. This breaks AI-vs-AI standoffs.
3. **Spending** (the Budget, highest priority first):

   | Request                                            | Priority |
   | -------------------------------------------------- | -------- |
   | Soldiers when threatened                           | 95       |
   | House when free population ≤ 3 + 2 per producer    | 90       |
   | Workers up to 16 (2 queued)                        | 80       |
   | First Barracks at 6 workers                        | 70       |
   | Soldiers, fewest-type first, 2 queued per building | 60       |
   | 2nd Barracks when rich and all are busy            | 45       |
   | One Watch Tower after 5:00                         | 40       |
   - What exists is read from the data: which buildings provide population, which train soldiers and which shoot.
   - **Finite resources:** it stops training workers when its stock plus what is left in safe nodes would drop below 300 of what a worker costs. This keeps food for the army.
   - Commands already sent but not yet applied are counted as spent.

4. **Workers:**
   - The share of workers per resource follows what the current wish list costs. A stockpile above 500 counts for less.
   - An idle worker goes to the resource most below its share, at a node near home, spreading workers over the nodes.
   - Every 12 s one worker moves from the most over-staffed to the most under-staffed resource.
   - It only uses **safe nodes**: nodes on its own half of the map and outside the range of enemy shooting buildings. Without this, it sent its workers to the enemy's berries once its own ran out, and they were shot.
5. At most 12 commands per think.

**Building placement** (`TileMap`):

- It searches around the Town Hall for a spot with a free walkable ring of one tile around the footprint, so the AI never walls itself in.
- Houses go to the back, away from the enemy. The Barracks and the tower go to the front.
- A spot the engine rejects is not tried again.

### Host

- `host/aiController.ts`:
  - `WorkerAIController` is the browser default: it posts `observe` every think and applies the commands at the tick they were meant for, or at once if they arrive late.
  - `InlineAIController` runs synchronously and deterministically, for tests.
  - Only events for that player are passed on.
- `GameHost.attachAI()` and `aiSink`: AI commands go through the same command log as the human's. The controller is disposed when the match ends.
- `/?ai=off` gives an idle opponent.

### UI

- The info box (bottom right) shows one line of what the machine is doing, for example: `Easy AI · attack · army 30 (2954 vs 750) · workers 16/16 · next wave 8 · saving for train militia`.
- **Result screen**: Victory, Defeat or Draw; the match time; a table of units trained and lost and buildings built and lost for You and the Machine; and **Play again**.

## 2. Tests

| File                           | What                                                                                                                                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/engine/victory.test.ts` | Losing the Town Hall ends the game and freezes it; a draw; arenas without Town Halls never end; stats; `observe()` and `staticInfo()` are plain cloneable data                                                                                                             |
| `tests/ai/parts.test.ts`       | Budget priority and reservation; placement keeps the free ring and prefers the requested side                                                                                                                                                                              |
| `tests/ai/ai.test.ts`          | Headless matches: the standard start builds workers, houses and a Barracks with no idle workers; only safe nodes are used; it beats an idle opponent from the standard start and from the scenario start; it defends its base against a 14-unit raid; same seed, same game |

## 3. Known limits and next steps

- **Food is finite.** Berries are the only food source, about 700 per side on Green Valley.
  - Each side can afford about 14 workers and 10 Militia, and then nothing more.
  - AI-vs-AI games end in a standoff after the armies trade, because nobody can train anything.
  - A human player hits the same wall.
  - Fix: a Farm (infinite food, as in the original §2.1), or more or regrowing berries. This is a game-design decision for the user.
- Wood piles up unused late in the game, because only houses, the Barracks and towers cost wood.
- There is one difficulty (Easy). Normal and Hard would be profile copies with different numbers once the economy allows longer games.
- No fog, by decision. The AI sees everything, as you do.
